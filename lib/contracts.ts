export type Locale = "zh-CN" | "en";
export type SourceId = "llm"|"prompt"|"rag"|"vector"|"langchain"|"agent"|"finetuning"|"multimodal"|"fullstack";
export interface Source { id:SourceId; title:string; filename:string; questionCount:number; pageCount:number; description:string }
export interface Annotation {questionId:string;kind:"correction"|"scope";title:string;body:string;references:{title:string;url:string}[]}
export interface Question {id:string; sourceId:SourceId;number:string;chapterId:string;chapterTitle:string;sectionId:string;sectionTitle:string;title:string;examFocus:string;explanation:string;answer:string;knowledge:string;extensions:string;pageStart:number;pageEnd:number;answerMissing:boolean;tags:string[]}
export type QuestionSummary=Pick<Question,"id"|"sourceId"|"number"|"chapterId"|"chapterTitle"|"sectionTitle"|"title"|"pageStart"|"answerMissing"> & {annotationCount:number};
export type Status="unseen"|"learning"|"mastered";
export interface StudyProgress {questionId:string;favorite:boolean;note:string;status:Status;reviewCount:number;lastReviewedAt:string|null;nextReviewAt:string|null;updatedAt:string;revision:number}
export interface Catalog {sources:Source[];chapters:{id:string;sourceId:SourceId;title:string;count:number}[];total:number;pages:number;missingAnswers:number;annotations:number}
export interface QuestionPage {items:QuestionSummary[];total:number;page:number;pageSize:number}
export interface ProgressWrite {expectedRevision:number;mutationId:string;favorite?:boolean;note?:string;status?:Status}
export interface ApiTransport {get<T>(path:string,signal?:AbortSignal):Promise<T>;put<T>(path:string,body:unknown):Promise<T>}
export class ApiError extends Error {constructor(public code:string,public status:number){super(code)}}

