import type {Locale,SourceId} from "./contracts";
const zh={
brand:"AI 面试练习室",workspace:"学习工作台",library:"题库浏览",practice:"模拟练习",review:"收藏与复习",overview:"学习进度",topics:"专题题库",
eyebrow:"BUILD YOUR NEXT CHAPTER",headline:"把知识，练成回答。",subtitle:"按专题梳理知识，在每一次练习中找到需要补强的地方。",start:"开始练习",
total:"全部题目",sources:"专题资料",pages:"原始内容",mastery:"已掌握",qUnit:"道",sourceUnit:"份",pageUnit:"页",search:"搜索题目、题号、知识点…",
allSources:"全部专题",allChapters:"全部章节",all:"全部状态",unseen:"未练习",learning:"待加强",mastered:"已掌握",favorite:"已收藏",due:"待复习",
questionList:"题目列表",results:"个结果",original:"中文原文",sourcePage:"原文页码",pdf:"打开 PDF 原文",missing:"原文答案缺失",annotated:"有订正提示",
before:"先组织你的回答",beforeHelp:"用“定义 → 原理 → 场景 → 权衡”的顺序回答，再与原文对照。",yourAnswer:"我的回答与笔记",notePlaceholder:"写下你的回答、关键例子或尚未理解的地方…",
saveNote:"保存笔记",showAnswer:"查看答案",hideAnswer:"收起答案",answer:"原文答案",reasoning:"解答过程",focus:"核心考点",knowledge:"知识点",extension:"拓展思考",
noAnswer:"这道题的原 PDF 没有提供答案，可结合解答过程复习并核对其他资料。",noField:"原文没有提供这部分内容。",
annotation:"订正与范围提示",correction:"概念订正",scope:"答题范围",references:"核对来源",selfRate:"看完后，评估你的掌握程度",rateHelp:"自评会保存当前笔记。待加强安排次日回顾，已掌握安排 7 天后回顾。",
saveSuccess:"已保存",saveFailed:"保存失败，笔记仍保留在页面中。",conflict:"其他窗口已更新这道题。已刷新记录，请核对笔记后再次保存。",storage:"学习记录暂时无法读取，请重试。",loadFailed:"内容加载失败，请重试。",retry:"重试",signIn:"登录后保存进度",savedCloud:"学习记录随账号保存",account:"个人学习空间",
previous:"上一页",next:"下一页",nextQuestion:"换一道题",empty:"没有找到题目",emptyHelp:"换一个关键词或清除筛选后再试。",clear:"清除筛选",emptyReview:"这里还没有复习题目",emptyReviewHelp:"在题目中收藏或标记待加强，随后回来继续复习。",
practiceTitle:"先回答，再对照。",practiceSubtitle:"每一题都练习把知识说清楚。选择专题后，从随机题目开始。",reviewTitle:"把薄弱点，练扎实。",reviewSubtitle:"回顾待加强的题目，或重读你收藏的重点。",overviewTitle:"看见你的积累。",overviewSubtitle:"掌握度来自你的自评。每次练习留下可继续的记录。",
reviewed:"已练题目",attempts:"自评次数",bookmarks:"收藏题目",progressByTopic:"各专题掌握进度",progressHelp:"按已掌握题目占该专题总题数计算",viewTopic:"进入专题",savedNotes:"有笔记",dueCount:"待复习",loading:"正在加载…",sourceLang:"题干、答案和订正为中文原文。",pdfHelp:"保留 PDF 物理页码；浏览器支持时直接跳转到对应页。",dataNote:"9 份 PDF · 2,464 道题",contentNote:"资料用于个人备考；原文答案需结合订正提示核对。",notesLimit:"最多 12,000 字",unsaved:"笔记尚未保存",revisionLabel:"上次自评",notReviewed:"尚未自评",today:"今天",allPractice:"在当前专题随机练习",backLibrary:"返回题库",randomEmpty:"当前筛选下没有可练习的题目。"
};
type Dictionary={ [K in keyof typeof zh]:string };
const en:Dictionary={
brand:"AI Interview Lab",workspace:"Study workspace",library:"Question bank",practice:"Practice",review:"Saved & review",overview:"Your progress",topics:"SUBJECTS",
eyebrow:"BUILD YOUR NEXT CHAPTER",headline:"Turn knowledge into answers.",subtitle:"Explore each subject, practise your explanation, and discover what to strengthen.",start:"Start practising",
total:"Questions",sources:"Source documents",pages:"Source pages",mastery:"Mastered",qUnit:"",sourceUnit:"",pageUnit:"",search:"Search questions, numbers, concepts…",
allSources:"All subjects",allChapters:"All chapters",all:"All statuses",unseen:"Not practised",learning:"Needs work",mastered:"Mastered",favorite:"Bookmarked",due:"To review",
questionList:"Questions",results:"results",original:"Chinese source text",sourcePage:"PDF page",pdf:"Open source PDF",missing:"Source answer missing",annotated:"Editorial note",
before:"Form your own answer first",beforeHelp:"Try this structure: definition → mechanism → use case → trade-offs. Then compare with the source.",yourAnswer:"My answer & notes",notePlaceholder:"Draft an answer, add an example, or capture what you need to revisit…",
saveNote:"Save notes",showAnswer:"Reveal answer",hideAnswer:"Hide answer",answer:"Source answer",reasoning:"Explanation",focus:"Key concepts",knowledge:"Knowledge points",extension:"Further thinking",
noAnswer:"The original PDF provides no answer for this question. Use the explanation and verify with other sources.",noField:"The source does not provide this section.",
annotation:"Corrections & scope notes",correction:"Correction",scope:"Scope note",references:"References",selfRate:"Assess your understanding",rateHelp:"Your notes are saved with the rating. Needs work is scheduled for tomorrow; mastered for 7 days later.",
saveSuccess:"Saved",saveFailed:"Saving failed. Your notes remain on this page.",conflict:"Another window changed this record. Progress was refreshed; check your notes before saving again.",storage:"Progress is temporarily unavailable. Please retry.",loadFailed:"Could not load this content. Please retry.",retry:"Retry",signIn:"Sign in to save progress",savedCloud:"Progress saved with your account",account:"Personal study space",
previous:"Previous",next:"Next",nextQuestion:"Another question",empty:"No questions found",emptyHelp:"Try another keyword or clear your filters.",clear:"Clear filters",emptyReview:"No questions to review yet",emptyReviewHelp:"Bookmark questions or mark them as needing work, then return here to review.",
practiceTitle:"Answer first. Then compare.",practiceSubtitle:"Practise explaining one idea clearly. Pick a subject and start with a random question.",reviewTitle:"Strengthen your weak spots.",reviewSubtitle:"Revisit questions that need work, or return to your bookmarked essentials.",overviewTitle:"See what you have built.",overviewSubtitle:"Mastery reflects your self-assessment. Every session leaves a record to build on.",
reviewed:"Questions practised",attempts:"Self-assessments",bookmarks:"Bookmarks",progressByTopic:"Mastery by subject",progressHelp:"Mastered questions divided by all questions in each subject",viewTopic:"Explore subject",savedNotes:"With notes",dueCount:"To review",loading:"Loading…",sourceLang:"Questions, answers and editorial notes are currently in Chinese.",pdfHelp:"Physical PDF page numbers are preserved. Supported browsers jump to the matching page.",dataNote:"9 PDFs · 2,464 questions",contentNote:"For personal interview preparation. Check source answers against the editorial notes.",notesLimit:"Up to 12,000 characters",unsaved:"Unsaved notes",revisionLabel:"Last assessed",notReviewed:"Not assessed yet",today:"Today",allPractice:"Random question in this subject",backLibrary:"Back to the bank",randomEmpty:"No questions available with these filters."
};
export const dictionaries:Record<Locale,Dictionary>={"zh-CN":zh,en};
export const subjectTitles:Record<SourceId,{ "zh-CN":string; en:string }>={llm:{"zh-CN":"大语言模型",en:"LLM development"},prompt:{"zh-CN":"Prompt 工程",en:"Prompt engineering"},rag:{"zh-CN":"RAG 检索增强",en:"RAG"},vector:{"zh-CN":"向量数据库",en:"Vector databases"},langchain:{"zh-CN":"LangChain",en:"LangChain"},agent:{"zh-CN":"AI Agent",en:"AI agents"},finetuning:{"zh-CN":"微调与部署",en:"Fine-tuning & deployment"},multimodal:{"zh-CN":"多模态应用",en:"Multimodal applications"},fullstack:{"zh-CN":"AI 全栈开发",en:"AI full-stack"}};

