#!/usr/bin/env python3
"""Verify progress SQL from the application source against its real migration.

Usage: python verify_progress_sql.py --progress-source lib/progress.ts \
    --schema-sql drizzle/0000_example.sql

Standard library only. No checkout or source files are modified. The tests run
the extracted SQL, not TypeScript or Cloudflare D1; fixture values are bound in
the order described by that SQL. Source binding count and return/replay guards
are checked separately. Unsupported SQL shapes fail instead of substituting SQL.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import json
from pathlib import Path
import re
import sqlite3
from tempfile import TemporaryDirectory
from threading import Barrier
from uuid import uuid4


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def split_args(text):
    """Split comma-separated SQL/TS expressions while retaining nested calls."""
    result, start, depth, quote, escaped = [], 0, 0, None, False
    for index, char in enumerate(text):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in "\"'`":
            quote = char
        elif char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        elif char == "," and depth == 0:
            result.append(text[start:index].strip())
            start = index + 1
    check(depth == 0 and quote is None, "Unbalanced SQL/source expression")
    result.append(text[start:].strip())
    return result


def read_source(path):
    source = path.read_text(encoding="utf-8-sig")
    match = re.search(
        r"const\s+(\w+)\s*=\s*await\s+db\.prepare\(`(INSERT\s+INTO.*?)`\)\s*\.bind\(",
        source, re.S | re.I,
    )
    check(match is not None, "Cannot locate the application's assigned UPSERT")
    variable, sql = match.groups()
    start, depth, quote, escaped = match.end(), 1, None, False
    index = start
    while index < len(source) and depth:
        char = source[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in "\"'`":
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        index += 1
    check(depth == 0, "Cannot locate the end of UPSERT .bind()")
    bindings = split_args(source[start:index - 1])
    check(re.match(r"\s*\.first\s*<\s*Row\s*>\s*\(\s*\)", source[index:]),
          "UPSERT must consume its RETURNING row with .first<Row>()")
    tail = source[index:]
    next_query = tail.find("db.prepare")
    return_guard = re.search(
        rf"if\s*\(\s*{re.escape(variable)}\s*\)\s*return\s+convert\s*\(\s*{re.escape(variable)}\s*\)",
        tail,
    )
    check(return_guard is not None and (next_query < 0 or return_guard.start() < next_query),
          "Successful write must return its own row before any fallback SELECT")
    compact = re.sub(r"\s+", "", source[:match.start()])
    check("if(current?.last_mutation_id===input.mutationId)returnconvert(current)" in compact,
          "Missing early same-mutation replay guard")
    queries = re.findall(r'prepare\("(SELECT\s+[^"\n]+)"\)', source, re.I)
    single = next((q for q in queries if re.search(r"user_id\s*=\s*\?\s+AND\s+question_id\s*=\s*\?", q, re.I)), None)
    user = next((q for q in queries if re.search(r"WHERE\s+user_id\s*=\s*\?\s*$", q, re.I)), None)
    check(single is not None and user is not None, "Cannot locate real per-user SELECTs")
    return sql, bindings, single, user


class BindPlan:
    """Map fixture fields to placeholders in the actual source SQL."""
    def __init__(self, sql, bindings):
        match = re.fullmatch(
            r"\s*INSERT\s+INTO\s+(\w+)\s*\((.*?)\)\s*SELECT\s+(.*?)\s+WHERE\s+(.*?)\s*"
            r"ON\s+CONFLICT\s*\((.*?)\)\s*DO\s+UPDATE\s+SET\s+(.*?)\s+WHERE\s+(.*?)\s+RETURNING\s+\*\s*;?\s*",
            sql, re.S | re.I,
        )
        check(match is not None, "Unsupported UPSERT shape or missing RETURNING *")
        table, columns, values, insert_guard, conflict, updates, update_guard = match.groups()
        self.table = table
        columns, values = split_args(columns), split_args(values)
        check(len(columns) == len(values), "INSERT columns and SELECT expressions differ")
        check(re.sub(r"\s", "", insert_guard) == "?=0", "Unsupported INSERT revision guard")
        check(split_args(conflict) == ["user_id", "question_id"], "UPSERT conflict key must include user and question")
        check(re.sub(r"\s", "", update_guard) == f"{table}.revision=?", "Missing revision CAS condition")
        self.order = []
        for column, expression in zip(columns, values):
            if expression == "?":
                self.order.append(column)
            else:
                check(column == "revision" and expression == "1", "Unsupported INSERT literal")
        self.order.append("_insert_guard")
        for assignment in split_args(updates):
            column, expression = map(str.strip, assignment.split("=", 1))
            if expression == "?":
                self.order.append(column)
            else:
                check(column == "revision" and re.sub(r"\s", "", expression) == f"{table}.revision+1",
                      "Unsupported UPDATE expression")
        self.order.append("_expected_revision")
        check(sql.count("?") == len(bindings) == len(self.order),
              f"Placeholder mismatch: SQL {sql.count('?')}, .bind {len(bindings)}, plan {len(self.order)}")
        self.sql = sql

    def values(self, user, question, mutation, expected, count, note="fixture", favorite=0):
        fields = dict(user_id=user, question_id=question, favorite=favorite, note=note,
                      status="learning", review_count=count, last_reviewed_at="2026-01-01T00:00:00.000Z",
                      next_review_at="2026-01-02T00:00:00.000Z", updated_at="2026-01-01T00:00:00.000Z",
                      last_mutation_id=mutation, _insert_guard=0, _expected_revision=expected)
        return tuple(fields[column] for column in self.order)


def connect(path):
    db = sqlite3.connect(path, timeout=10, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db


def write(db, plan, values):
    cursor = db.execute(plan.sql, values)
    rows = cursor.fetchall()  # Finalize RETURNING before a second connection writes.
    cursor.close()
    check(len(rows) <= 1, "One progress write returned multiple rows")
    return dict(rows[0]) if rows else None


def run(progress_source, schema_sql):
    sql, bindings, single_sql, user_sql = read_source(progress_source)
    plan = BindPlan(sql, bindings)
    migration = schema_sql.read_text(encoding="utf-8-sig")
    tests = []
    with TemporaryDirectory(prefix="verify-progress-") as folder:
        database = Path(folder) / "progress.sqlite"
        with closing(connect(database)) as db:
            db.executescript(migration)
            db.execute("PRAGMA journal_mode=WAL").fetchone()

            def read(user, question):
                row = db.execute(single_sql, (user, question)).fetchone()
                return dict(row) if row else None

            # Same question, two users: both keys and the real user query must isolate data.
            for user, note in (("alice", "Alice only"), ("bob", "Bob only")):
                write(db, plan, plan.values(user, "isolation", str(uuid4()), 0, 1, note))
            write(db, plan, plan.values("alice", "isolation", str(uuid4()), 1, 2, "Alice changed", 1))
            check(read("alice", "isolation")["revision"] == 2, "Alice update failed")
            check(read("bob", "isolation")["revision"] == 1, "Alice update changed Bob's revision")
            check(read("bob", "isolation")["note"] == "Bob only", "Alice update changed Bob's note")
            for user in ("alice", "bob"):
                rows = db.execute(user_sql, (user,)).fetchall()
                check(len(rows) == 1 and all(r["user_id"] == user for r in rows), "Per-user query leaked rows")
            tests.append("two_user_isolation")

            # Two connections read the same revision before a barrier, then race their writes.
            for seeded in (False, True):
                question = "race-existing" if seeded else "race-new"
                if seeded:
                    write(db, plan, plan.values("alice", question, str(uuid4()), 0, 1))
                barrier = Barrier(2)
                mutations = [str(uuid4()), str(uuid4())]

                def contender(mutation):
                    with closing(connect(database)) as other:
                        current = other.execute(single_sql, ("alice", question)).fetchone()
                        expected = current["revision"] if current else 0
                        count = (current["review_count"] if current else 0) + 1
                        values = plan.values("alice", question, mutation, expected, count)
                        barrier.wait(timeout=10)
                        return write(other, plan, values)

                with ThreadPoolExecutor(max_workers=2) as executor:
                    results = list(executor.map(contender, mutations))
                winners = [row for row in results if row is not None]
                expected_revision = 2 if seeded else 1
                check(len(winners) == 1, "CAS race must have exactly one successful writer")
                saved = read("alice", question)
                check(saved["revision"] == expected_revision and saved["review_count"] == expected_revision,
                      "CAS loser changed revision or review count")
                check(saved["last_mutation_id"] == winners[0]["last_mutation_id"], "Wrong mutation won the CAS race")
                tests.append("cas_existing_row" if seeded else "cas_new_row")

            # Replay the original mutation with its original expected revision, including a concurrent duplicate.
            for seeded in (False, True):
                question = "replay-existing" if seeded else "replay-new"
                if seeded:
                    write(db, plan, plan.values("alice", question, str(uuid4()), 0, 1))
                mutation, expected = str(uuid4()), int(seeded)
                values = plan.values("alice", question, mutation, expected, expected + 1)
                first = write(db, plan, values)
                duplicate = write(db, plan, values)
                saved = read("alice", question)
                check(first is not None and duplicate is None, "Duplicate mutation unexpectedly wrote twice")
                check(saved["last_mutation_id"] == mutation, "Fallback SELECT cannot recognize the replay")
                check(saved["revision"] == expected + 1 and saved["review_count"] == expected + 1,
                      "Mutation replay incremented review count or revision")
            tests.append("mutation_replay_count")

            # A later writer may commit before A's response, while A keeps its own RETURNING snapshot.
            question = "stable-return"
            write(db, plan, plan.values("alice", question, str(uuid4()), 0, 1))
            mutation_a, mutation_b = str(uuid4()), str(uuid4())
            returned_a = write(db, plan, plan.values("alice", question, mutation_a, 1, 2, "A"))
            with closing(connect(database)) as other:
                returned_b = write(other, plan, plan.values("alice", question, mutation_b, 2, 3, "B"))
            check(returned_a["revision"] == 2 and returned_a["last_mutation_id"] == mutation_a and returned_a["note"] == "A",
                  "A lost its successful RETURNING row after B wrote")
            check(returned_b["revision"] == 3 and read("alice", question)["last_mutation_id"] == mutation_b,
                  "Later successful write was not committed")
            tests.append("returning_row_stability")
    return dict(ok=True, sqlite_version=sqlite3.sqlite_version, progress_source=str(progress_source.resolve()),
                schema_sql=str(schema_sql.resolve()), placeholders=len(plan.order), tests=tests,
                scope="Actual SQL + source guards; does not execute TypeScript or Cloudflare D1")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--progress-source", type=Path, required=True, help="Application lib/progress.ts")
    parser.add_argument("--schema-sql", type=Path, required=True, help="Real Drizzle-generated SQLite migration")
    args = parser.parse_args()
    try:
        result = run(args.progress_source, args.schema_sql)
    except (AssertionError, OSError, sqlite3.Error, ValueError) as error:
        parser.exit(1, f"FAIL: {error}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
