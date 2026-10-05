import { sqliteTable,text,integer,primaryKey } from "drizzle-orm/sqlite-core";
export const studyProgress=sqliteTable("study_progress",{
userId:text("user_id").notNull(),questionId:text("question_id").notNull(),
favorite:integer("favorite").notNull().default(0),note:text("note").notNull().default(""),
status:text("status").notNull().default("unseen"),reviewCount:integer("review_count").notNull().default(0),
lastReviewedAt:text("last_reviewed_at"),nextReviewAt:text("next_review_at"),
updatedAt:text("updated_at").notNull(),revision:integer("revision").notNull().default(1),
lastMutationId:text("last_mutation_id").notNull()
},t=>[primaryKey({columns:[t.userId,t.questionId]})]);

