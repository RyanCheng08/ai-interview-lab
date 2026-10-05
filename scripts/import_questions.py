"""Import the supplied interview PDFs without inventing or repairing their answers.

Default input is the extraction directory beside this project. Run with the bundled
Python runtime. pdfplumber is required only for the two watermark-bearing text
copies, or when --reextract is supplied. The original PDFs are never modified.
"""

from __future__ import annotations

import argparse
import bisect
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path


SOURCES = [
    ("llm", "大语言模型应用开发", "《大语言模型应用开发》310道面试题.pdf", 310, 154, 13,
     "覆盖模型基础、API、上下文、RAG、工具、框架与生产部署的综合题库。"),
    ("prompt", "Prompt工程", "《Prompt工程》210道面试题.pdf", 210, 108, 10,
     "覆盖提示设计、示例、提示链、上下文、效果评估与版本管理。"),
    ("rag", "RAG检索增强生成", "《RAG检索增强生成》198道面试题.pdf", 198, 100, 9,
     "覆盖检索增强生成的架构、分块、召回、重排序与评估。"),
    ("vector", "向量数据库", "《向量数据库》301道面试题.pdf", 301, 148, 13,
     "覆盖向量表示、相似度、索引、查询与数据库运维。"),
    ("langchain", "LangChain框架", "《LangChain框架》226道面试题.pdf", 226, 113, 10,
     "覆盖链、提示、记忆、工具、代理、回调与集成。"),
    ("agent", "AI Agent开发", "《AI Agent开发》158道面试题.pdf", 158, 79, 7,
     "覆盖计划执行、记忆、工具调用、多轮对话、协作与部署。"),
    ("finetuning", "模型微调与部署", "《模型微调与部署》294道面试题.pdf", 294, 144, 12,
     "覆盖模型微调、训练优化、推理与部署工程。"),
    ("multimodal", "多模态模型应用", "《多模态模型应用》317道面试题.pdf", 317, 158, 13,
     "覆盖图像、语音、视频与文本的模型融合和应用。"),
    ("fullstack", "AI全栈开发工程师", "AI全栈开发工程师.pdf", 450, 916, 29,
     "15章综合题库，包含题目解读、知识点、答案和拓展思考。"),
]

PAGE_RE = re.compile(r"(?m)^={3,}\s*PDF(?: PAGE|物理页)\s*(\d+)\s*={3,}\s*$")
QUESTION_RE = re.compile(r"(?m)^(\d+\.\d+\.\d+)\.[ \t]*")
HEADING_RE = re.compile(r"(?m)^(\d+(?:\.\d+)?)\.[ \t]+([^\n]+)$")
SPECIAL_LABEL_RE = re.compile(r"(?m)^(考点|解答过程|答案)(?:[ \t:：]+|$)")
FULL_LABEL_RE = re.compile(r"(?m)^(题目解读|知识点|答案|拓展思考)[ \t]*[:：][ \t]*")
FULL_MARKER_RE = re.compile(r"@@@(\d+(?:\.\d+){0,2})@@@")


def normalize_radicals(text: str) -> str:
    """Normalize only Kangxi/CJK radical glyphs, not punctuation or code syntax."""
    return "".join(unicodedata.normalize("NFKC", c)
                   if 0x2F00 <= ord(c) <= 0x2FDF else c for c in text)


def clean_page(text: str, page: int, fullstack: bool) -> str:
    lines = normalize_radicals(text).splitlines()
    while lines and not lines[-1].strip():
        lines.pop()
    if lines and lines[-1].strip() == str(page):
        lines.pop()  # Specialty-page footer, only at the end of the page.
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if fullstack and (stripped.startswith("创脉思 (cms365.cn)")
                          or re.fullmatch(r"第\s*\d+\s*页\s*/\s*共\s*\d+\s*页", stripped)):
            continue
        if stripped in ("内部使用", "26479"):
            continue
        cleaned.append(line.rstrip())
    return "\n".join(cleaned).strip("\n")


@dataclass
class Document:
    text: str
    page_offsets: list[int]
    page_numbers: list[int]

    def page_at(self, position: int) -> int:
        return self.page_numbers[max(0, bisect.bisect_right(self.page_offsets, position) - 1)]


def text_document(raw: str, start_page: int, fullstack: bool) -> Document:
    markers = list(PAGE_RE.finditer(raw))
    if not markers:
        raise ValueError("No physical-page markers found")
    parts, offsets, numbers, length = [], [], [], 0
    for i, marker in enumerate(markers):
        page = int(marker[1])
        if page < start_page:
            continue
        end = markers[i + 1].start() if i + 1 < len(markers) else len(raw)
        content = clean_page(raw[marker.end():end], page, fullstack)
        offsets.append(length)
        numbers.append(page)
        parts.append(content)
        length += len(content) + 1
    return Document("\n".join(parts), offsets, numbers)


def extract_pdf(path: Path) -> str:
    import pdfplumber
    pages = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            filtered = page.filter(lambda obj: obj.get("object_type") != "char"
                                   or abs(obj.get("matrix", (1, 0, 0, 1, 0, 0))[1]) < 0.01)
            pages.append(f"\n=== PDF PAGE {i} ===\n{filtered.extract_text() or ''}")
    return "\n".join(pages)


def compact_title(text: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines() if line.strip()]
    result = ""
    for line in lines:
        # A PDF wrap between Chinese characters is not an actual word separator.
        needs_space = bool(result and result[-1].isascii() and result[-1].isalnum()
                           and line[0].isascii() and line[0].isalnum())
        result += (" " if needs_space else "") + line
    return result


TAG_RULES = [
    ("RAG", r"RAG|检索增强"), ("向量检索", r"向量|Embedding|嵌入"),
    ("Prompt", r"Prompt|提示|Few.?shot|少样本|零样本"),
    ("Agent", r"Agent|智能体|代理"), ("ReAct", r"ReAct"),
    ("LangChain", r"LangChain"), ("LlamaIndex", r"LlamaIndex"),
    ("LoRA", r"LoRA|QLoRA"), ("微调", r"微调|Fine.?tun"),
    ("多模态", r"多模态|图像|视觉|语音|音频|视频"),
    ("API", r"API|REST|HTTP|接口"), ("工具调用", r"Tool|工具|Function.?Calling|函数调用"),
    ("上下文", r"上下文|对话|Memory|记忆|Session"),
    ("安全", r"安全|权限|注入|隐私|沙箱|OAuth|认证|脱敏"),
    ("评估", r"评估|评价|测试|指标|A/B|AB测试|验证"),
    ("性能", r"性能|优化|延迟|并发|缓存|吞吐|瓶颈"),
    ("部署", r"部署|容器|Kubernetes|灰度|运维|服务化|云原生"),
    ("成本", r"成本|预算|Token|计费"),
    ("Python", r"Python"), ("JavaScript", r"JavaScript|Node\.js|ES6"),
    ("Transformer", r"Transformer|注意力"),
]


def tags_for(title: str, focus: str, chapter: str, section: str) -> list[str]:
    haystack = " ".join((title, focus, chapter, section))
    return [label for label, pattern in TAG_RULES if re.search(pattern, haystack, re.I)]


def make_question(source_id: str, number: str, title: str, chapter: str,
                  section: str, fields: dict[str, str], start: int, end: int,
                  doc: Document) -> dict:
    chapter_num, section_num = number.split(".")[0], ".".join(number.split(".")[:2])
    answer = fields.get("答案", "").strip("\n ")
    focus = fields.get("考点", "").strip("\n ")
    title = compact_title(title)
    return {
        "id": f"{source_id}-{number}", "sourceId": source_id, "number": number,
        "chapterId": f"{source_id}-{chapter_num}", "chapterTitle": compact_title(chapter),
        "sectionId": f"{source_id}-{section_num}", "sectionTitle": compact_title(section),
        "title": title, "examFocus": focus,
        "explanation": fields.get("解答过程", fields.get("题目解读", "")).strip("\n "),
        "answer": answer, "knowledge": fields.get("知识点", "").strip("\n "),
        "extensions": fields.get("拓展思考", "").strip("\n "),
        "pageStart": doc.page_at(start), "pageEnd": doc.page_at(end),
        "answerMissing": not bool(answer),
        "tags": tags_for(title, focus, chapter, section),
    }


def split_fields(segment: str, label_re: re.Pattern) -> tuple[str, dict[str, str]]:
    labels = list(label_re.finditer(segment))
    if not labels:
        raise ValueError(f"Question has no field labels: {segment[:120]!r}")
    fields = {}
    for i, label in enumerate(labels):
        end = labels[i + 1].start() if i + 1 < len(labels) else len(segment)
        if label[1] in fields:
            raise ValueError(f"Repeated field label {label[1]!r} in {segment[:80]!r}")
        fields[label[1]] = segment[label.end():end].strip("\n ")
    return segment[:labels[0].start()], fields


def specialty_questions(source_id: str, doc: Document) -> list[dict]:
    text = doc.text
    matches = list(QUESTION_RE.finditer(text))
    heading_matches = list(HEADING_RE.finditer(text))
    headings = {}
    for question in matches:
        number = question[1]
        for prefix in (number.split(".")[0], ".".join(number.split(".")[:2])):
            if prefix in headings:
                continue
            candidates = [h for h in heading_matches if h[1] == prefix and h.start() < question.start()]
            if not candidates:
                raise ValueError(f"Missing heading {source_id}:{prefix}")
            headings[prefix] = candidates[-1]
    output = []
    for i, question in enumerate(matches):
        next_start = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        end = next_start
        if i + 1 < len(matches):
            next_num = matches[i + 1][1]
            for prefix in (next_num.split(".")[0], ".".join(next_num.split(".")[:2])):
                header = headings[prefix]
                if question.start() < header.start() < end:
                    end = header.start()
        segment = text[question.end():end].rstrip()
        title, fields = split_fields(segment, SPECIAL_LABEL_RE)
        number = question[1]
        ch, sec = number.split(".")[0], ".".join(number.split(".")[:2])
        output.append(make_question(source_id, number, title, headings[ch][2], headings[sec][2],
                                    fields, question.start(), question.end() + len(segment) - 1, doc))
    return output


def fullstack_questions(doc: Document) -> list[dict]:
    text, events = doc.text, []
    previous_end = 0
    for marker in FULL_MARKER_RE.finditer(text):
        number = marker[1]
        pattern = re.compile(r"(?m)^" + re.escape(number) + r"[ \t]+")
        candidates = list(pattern.finditer(text, previous_end, marker.start()))
        if not candidates:
            raise ValueError(f"Cannot locate fullstack heading {number}")
        header = candidates[-1]
        events.append({"number": number, "start": header.start(), "contentStart": marker.end(),
                       "title": compact_title(text[header.end():marker.start()])})
        previous_end = marker.end()
    output, chapters, sections = [], {}, {}
    for i, event in enumerate(events):
        number = event["number"]
        depth = len(number.split("."))
        if depth == 1:
            chapters[number] = event["title"]
            continue
        if depth == 2:
            sections[number] = event["title"]
            continue
        end = events[i + 1]["start"] if i + 1 < len(events) else len(text)
        segment = text[event["contentStart"]:end].rstrip()
        _, fields = split_fields(segment, FULL_LABEL_RE)
        ch, sec = number.split(".")[0], ".".join(number.split(".")[:2])
        output.append(make_question("fullstack", number, event["title"], chapters[ch], sections[sec],
                                    fields, event["start"], event["contentStart"] + len(segment) - 1, doc))
    return output


def validate(bank: dict) -> dict:
    ids = [q["id"] for q in bank["questions"]]
    assert len(ids) == len(set(ids)), "Duplicate question IDs"
    assert len(ids) == 2464, f"Expected 2464 questions, got {len(ids)}"
    stats, source_anomalies = {}, []
    for source in bank["sources"]:
        questions = [q for q in bank["questions"] if q["sourceId"] == source["id"]]
        assert len(questions) == source["questionCount"], source["id"]
        for q in questions:
            assert q["title"] and q["chapterTitle"] and q["sectionTitle"], q["id"]
            assert 1 <= q["pageStart"] <= q["pageEnd"] <= source["pageCount"], q["id"]
            assert q["answerMissing"] == (not bool(q["answer"])), q["id"]
            joined = "\n".join(str(q[k]) for k in ("title", "examFocus", "explanation", "answer", "knowledge", "extensions"))
            assert "\ufffd" not in joined and "@@@" not in joined and not PAGE_RE.search(joined), q["id"]
            assert "cms365.cn" not in joined and not re.search(r"(?m)^内部使用$", joined), q["id"]
            assert not any(ord(c) < 32 and c not in "\n\t\r" for c in joined), q["id"]
            for field in ("title", "examFocus", "explanation", "answer", "knowledge", "extensions"):
                unusual = sorted({c for c in q[field] if any(script in unicodedata.name(c, "")
                                  for script in ("CYRILLIC", "TAMIL", "THAI", "TELUGU", "ORIYA", "SINHALA"))})
                if unusual:
                    source_anomalies.append({"questionId": q["id"], "field": field,
                                             "pageStart": q["pageStart"], "pageEnd": q["pageEnd"],
                                             "characters": "".join(unusual),
                                             "note": "保留来源文本中的异语字符，未擅自替换或补写。"})
        assert all(q["pageStart"] <= n["pageStart"] for q, n in zip(questions, questions[1:])), source["id"]
        assert all(q["pageEnd"] <= n["pageStart"] for q, n in zip(questions, questions[1:])), source["id"]
        stats[source["id"]] = {
            "questions": len(questions),
            "chapters": len({q["chapterId"] for q in questions}),
            "sections": len({q["sectionId"] for q in questions}),
            "answerMissing": sum(q["answerMissing"] for q in questions),
            "firstPage": min(q["pageStart"] for q in questions),
            "lastPage": max(q["pageEnd"] for q in questions),
            "crossPageQuestions": sum(q["pageEnd"] > q["pageStart"] for q in questions),
        }
    return {"totalQuestions": len(ids), "uniqueIds": len(set(ids)),
            "answerMissingTotal": sum(q["answerMissing"] for q in bank["questions"]),
            "sources": stats, "originalTextAnomalies": source_anomalies,
            "checks": {"countsMatch": True, "uniqueIds": True, "pageBounds": True,
                       "pageOrder": True, "noReplacementCharacters": True,
                       "noPageMarkerOrPublisherFooterLeakage": True}}


def main() -> None:
    workspace = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text-dir", type=Path, default=workspace / "tmp/pdfs/interview_analysis")
    parser.add_argument("--pdf-dir", type=Path, default=workspace / "面试题")
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("question-bank.json"))
    parser.add_argument("--reextract", action="store_true", help="Reextract all specialty PDFs with watermark filtering")
    args = parser.parse_args()
    bank = {"schemaVersion": 1, "sources": [], "questions": []}
    cache = Path(__file__).with_name(".extraction-cache")
    for source_id, title, filename, count, pages, body_page, description in SOURCES:
        source = {"id": source_id, "title": title, "filename": filename,
                  "questionCount": count, "pageCount": pages, "description": description}
        fullstack = source_id == "fullstack"
        if fullstack:
            raw = (args.text_dir / "AI全栈开发工程师.normalized.txt").read_text(encoding="utf-8")
        elif args.reextract or source_id in ("finetuning", "multimodal"):
            cache.mkdir(parents=True, exist_ok=True)
            cached = cache / (source_id + ".txt")
            pdf_path = args.pdf_dir / filename
            if args.reextract or not cached.exists() or cached.stat().st_mtime < pdf_path.stat().st_mtime:
                raw = extract_pdf(args.pdf_dir / filename)
                cached.write_text(raw, encoding="utf-8")
            else:
                raw = cached.read_text(encoding="utf-8")
        else:
            raw = (args.text_dir / (Path(filename).stem + ".agent.txt")).read_text(encoding="utf-8")
        doc = text_document(raw, body_page, fullstack)
        assert doc.page_numbers == list(range(body_page, pages + 1)), f"{source_id}: page markers incomplete"
        questions = fullstack_questions(doc) if fullstack else specialty_questions(source_id, doc)
        assert len(questions) == count, f"{source_id}: expected {count}, got {len(questions)}"
        bank["sources"].append(source)
        bank["questions"].extend(questions)
        print(f"Imported {source_id}: {len(questions)} questions", flush=True)
    report = validate(bank)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.output.with_name("validation-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
