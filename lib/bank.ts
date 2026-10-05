import raw from "@/data/question-bank.json";
import annotationsRaw from "@/data/corrections.json";
import type {Question,Source,Annotation,QuestionSummary,Catalog} from "./contracts";
export const questions=raw.questions as Question[];
export const sources=raw.sources as Source[];
export const annotations=annotationsRaw as Annotation[];
const byId=new Map(questions.map(q=>[q.id,q]));
const annotationMap=new Map<string,Annotation[]>();
for(const a of annotations)annotationMap.set(a.questionId,[...(annotationMap.get(a.questionId)||[]),a]);
export function findQuestion(id:string){return byId.get(id)}
export function getAnnotations(id:string){return annotationMap.get(id)||[]}
export function summary(q:Question):QuestionSummary{const {id,sourceId,number,chapterId,chapterTitle,sectionTitle,title,pageStart,answerMissing}=q;return {id,sourceId,number,chapterId,chapterTitle,sectionTitle,title,pageStart,answerMissing,annotationCount:getAnnotations(id).length}}
const chapters=new Map<string,Catalog["chapters"][number]>();
for(const q of questions){const chapter=chapters.get(q.chapterId)||{id:q.chapterId,sourceId:q.sourceId,title:q.chapterTitle,count:0};chapter.count++;chapters.set(q.chapterId,chapter)}
export const catalog:Catalog={sources,chapters:[...chapters.values()],total:questions.length,pages:sources.reduce((n,s)=>n+s.pageCount,0),missingAnswers:questions.filter(q=>q.answerMissing).length,annotations:annotations.length};
export function searchBank(query:string,sourceId:string,chapterId:string){const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return questions.filter(q=>(!sourceId||q.sourceId===sourceId)&&(!chapterId||q.chapterId===chapterId)&&terms.every(t=>(q.title+" "+q.number+" "+q.chapterTitle+" "+q.sectionTitle+" "+q.tags.join(" ")+" "+q.examFocus+" "+q.knowledge+" "+q.answer+" "+q.explanation+" "+getAnnotations(q.id).map(a=>a.title+" "+a.body).join(" ")).toLocaleLowerCase().includes(t)))}

