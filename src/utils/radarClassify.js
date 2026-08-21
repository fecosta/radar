/**
 * RADAR classification rules engine.
 *
 * Given a plain-language description of a document someone wants to save, returns the
 * official RADAR folder path and a suggested file name. Ported verbatim from the
 * "RADAR File Finder" Google Apps Script — pure text processing, no network calls,
 * no Drive API, no OAuth scope.
 *
 * Labels are localized to EN/ES/PT from the auto-detected language of the description.
 *
 * Theme values come from the canonical model rather than literals: v06 permits Cross_Thematic
 * only where the canonical tree defines it, so theme validity is resolved per location.
 */

import { THEMES, CROSS_THEMATIC, THEMES_WITH_CROSS_THEMATIC } from '../radar/canonicalTree.js';

/* ─── Primitives ──────────────────────────────────────────── */

function norm(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-');
}
function slug(s){
  return (s||'').trim().replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'_').replace(/_+/g,'_') || '[Object]';
}
function today(){
  const d=new Date();
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function detectLanguage(text){
  const t=' '+norm(text)+' ';
  const scores={es:0,en:0,pt:0};
  const words={
    es:[' el ',' la ',' los ',' las ',' de ',' para ',' sobre ',' reunion ',' informe ',' evaluacion ',' borrador ',' guardar ',' politica ',' datos ',' fotos ',' acta ',' estrategia '],
    pt:[' o ',' a ',' os ',' as ',' de ',' para ',' sobre ',' reuniao ',' relatorio ',' avaliacao ',' rascunho ',' guardar ',' politica ',' dados ',' fotos ',' ata ',' estrategia '],
    en:[' the ',' a ',' an ',' of ',' for ',' about ',' meeting ',' report ',' evaluation ',' draft ',' save ',' policy ',' data ',' photos ',' strategy ',' notes ']
  };
  for(const [l,arr] of Object.entries(words)) for(const w of arr) if(t.includes(w)) scores[l]++;
  if(/[ãõç]/i.test(text)) scores.pt+=3;
  if(/[¿¡ñ]/i.test(text)) scores.es+=3;
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0] || 'en';
}

/* ─── Localized labels ────────────────────────────────────── */

const ui={
  en:{recommended:'Recommended location', folder:'Official folder', name:'Suggested file name', why:'Why:', alternatives:'Other possible locations', high:'High confidence', medium:'Medium confidence', low:'Low confidence', need:'To improve this recommendation:', object:'add the organization/program/topic name', context:'select the work context', theme:'select the theme for this location (Cross_Thematic only where RADAR defines it)', specialLabel:'Special RADAR case:', beca:'Beca Tech is treated as an Education In-house Program. Keep one stable Beca Tech folder and use year/cohort/study/event subfolders only where volume makes them useful; participant data remains restricted.', democracia:'Democracia+ is currently treated as a Democracy Venture Building initiative with an expanded portable structure. Organizations managed through Democracia+ belong under 04_Subportfolio_and_Organizations; if its operating model changes, move the full folder.', emergency:'Emergency_Response is treated as a Cross_Thematic In-house Program because ver+ operates the work directly and it does not sit naturally under Education or Democracy. It uses the standard In-house Program structure, including restricted participant/beneficiary data. Cross_Thematic is not a general “other” folder.'},
  es:{recommended:'Ubicación recomendada', folder:'Carpeta oficial', name:'Nombre sugerido del archivo', why:'Por qué:', alternatives:'Otras ubicaciones posibles', high:'Confianza alta', medium:'Confianza media', low:'Confianza baja', need:'Para mejorar esta recomendación:', object:'agrega el nombre de la organización/programa/tema', context:'selecciona el contexto de trabajo', theme:'selecciona el tema de esta ubicación (Cross_Thematic solo donde RADAR lo define)', specialLabel:'Caso especial de RADAR:', beca:'Beca Tech se gestiona como un In-house Program de Education. Mantén una única carpeta estable de Beca Tech y crea subcarpetas por año/cohorte/estudio/evento solo cuando el volumen lo justifique; los datos de participantes deben tener acceso restringido.', democracia:'Democracia+ se gestiona actualmente como una iniciativa de Venture Building en Democracy, con una estructura ampliada y portable. Las organizaciones gestionadas a través de Democracia+ van en 04_Subportfolio_and_Organizations; si cambia su modelo operativo, se mueve la carpeta completa.', emergency:'Emergency_Response se gestiona como un In-house Program Cross_Thematic porque ver+ opera el trabajo directamente y no encaja naturalmente en Education ni en Democracy. Usa la estructura estándar de In-house Program, incluidos los datos restringidos de participantes/beneficiarios. Cross_Thematic no es una carpeta genérica de “otros”.'},
  pt:{recommended:'Local recomendado', folder:'Pasta oficial', name:'Nome sugerido do arquivo', why:'Por quê:', alternatives:'Outros locais possíveis', high:'Alta confiança', medium:'Confiança média', low:'Baixa confiança', need:'Para melhorar esta recomendação:', object:'adicione o nome da organização/programa/tema', context:'selecione o contexto de trabalho', theme:'selecione o tema deste local (Cross_Thematic apenas onde o RADAR o define)', specialLabel:'Caso especial do RADAR:', beca:'Beca Tech é gerida como um In-house Program de Education. Mantenha uma única pasta estável de Beca Tech e crie subpastas por ano/coorte/estudo/evento apenas quando o volume justificar; os dados de participantes devem ter acesso restrito.', democracia:'Democracia+ é atualmente gerida como uma iniciativa de Venture Building em Democracy, com estrutura ampliada e portátil. Organizações geridas por meio de Democracia+ ficam em 04_Subportfolio_and_Organizations; se o modelo operacional mudar, mova a pasta completa.', emergency:'Emergency_Response é gerido como um In-house Program Cross_Thematic porque a ver+ opera o trabalho diretamente e ele não se encaixa naturalmente em Education ou Democracy. Usa a estrutura padrão de In-house Program, incluindo os dados restritos de participantes/beneficiários. Cross_Thematic não é uma pasta genérica de “outros”.'}
};

/**
 * Label set for a detected language, for UI chrome the classifyRadar result doesn't carry
 * (`recommended`, `folder`, `name`, `why`). Falls back to English.
 */
export function getLabels(lang){
  return ui[lang] || ui.en;
}

const knownObjects={
  'aprendo+':{context:'portfolio',theme:'Education'},
  'beca tech':{context:'inhouse',theme:'Education',special:'beca'},
  'beca_tech':{context:'inhouse',theme:'Education',special:'beca'},
  'democracia+':{context:'venture',theme:'Democracy',special:'democracia'},
  // v06 SPECIAL CASE - EMERGENCY RESPONSE: a Cross_Thematic In-house Program.
  'emergency response':{context:'inhouse',theme:CROSS_THEMATIC,special:'emergency'},
  'emergency_response':{context:'inhouse',theme:CROSS_THEMATIC,special:'emergency'}
};

/* ─── Inference ───────────────────────────────────────────── */

function hit(t, arr){ return arr.reduce((n,k)=>n+(t.includes(norm(k))?1:0),0); }

/**
 * Shown when no theme was selected and none could be inferred. Two forms, because the set of
 * offerable themes depends on the destination (v06 design rule 2).
 */
const THEME_PLACEHOLDER=`[${THEMES.join('|')}]`;
const THEME_PLACEHOLDER_CROSS=`[${THEMES_WITH_CROSS_THEMATIC.join('|')}]`;
const isPlaceholder=(v)=>typeof v==='string' && v.startsWith('[');

/** Phrases that mean "this genuinely spans both themes", not "I could not decide". */
const CROSS_THEMATIC_WORDS=['cross thematic','cross-thematic','both themes','ambos temas','ambos os temas','education and democracy','educacion y democracia','educação e democracia','transversal theme','tema transversal'];

/**
 * The theme to place in a path, given the themes that location actually permits.
 *
 * A Cross_Thematic selection must never produce `01_PIPELINE/Cross_Thematic/...`: where the
 * location forbids it the theme is reported as still needed rather than silently swapped for
 * a core theme RADAR has no basis to choose.
 */
function themeFor(allowed, theme){
  if(allowed.includes(theme)) return theme;
  return allowed.includes(CROSS_THEMATIC) ? THEME_PLACEHOLDER_CROSS : THEME_PLACEHOLDER;
}
function themeNeeds(resolved){ return isPlaceholder(resolved) ? ['theme'] : []; }

function inferTheme(t, selected){
  if(selected!=='auto') return selected;
  // Checked first: "education and democracy" also matches the Education keywords below.
  if(hit(t,CROSS_THEMATIC_WORDS)>0) return CROSS_THEMATIC;
  if(hit(t,['education','educacion','educação','school','schools','escuela','escola','teacher','docente','student','estudiante','aluno','aprendo','beca tech','early childhood','primera infancia','primeira infancia','k12','ece','talent','talento'])>0) return 'Education';
  if(hit(t,['democracy','democracia','government','gobierno','governo','political','politica','política','public leadership','liderazgo politico','lideranca politica','state capacity','capacidad estatal','capacidade estatal'])>0) return 'Democracy';
  return THEME_PLACEHOLDER;
}
function inferStatus(t){
  if(hit(t,['signed','firmado','assinado'])) return 'SIGNED';
  if(hit(t,['approved','aprobado','aprovado'])) return 'APPROVED';
  if(hit(t,['for review','para revision','para revisión','para revisao','para revisão','review version'])) return 'FOR_REVIEW';
  if(hit(t,['superseded','reemplazado','sustituido','substituido','obsoleto'])) return 'SUPERSEDED';
  return 'DRAFT';
}
function inferObject(text, supplied){
  if(supplied.trim()) return supplied.trim();
  const raw=text.trim();
  const patterns=[
    /(?:of|for|about)\s+([A-ZÁÉÍÓÚÑÃÕÇ][\wÀ-ÿ+&.-]*(?:\s+[A-ZÁÉÍÓÚÑÃÕÇ][\wÀ-ÿ+&.-]*){0,3})/,
    /(?:de|del|da|do|para|sobre)\s+([A-ZÁÉÍÓÚÑÃÕÇ][\wÀ-ÿ+&.-]*(?:\s+[A-ZÁÉÍÓÚÑÃÕÇ][\wÀ-ÿ+&.-]*){0,3})/
  ];
  for(const p of patterns){ const m=raw.match(p); if(m && m[1]) return m[1].trim(); }
  for(const k of Object.keys(knownObjects)) if(norm(raw).includes(norm(k))) return k.replace('_',' ');
  return '[Object]';
}
function inferContext(t, selected, object){
  if(selected!=='auto') return selected;
  const o=norm(object);
  for(const [name,meta] of Object.entries(knownObjects)) if(o.includes(norm(name))||t.includes(norm(name))) return meta.context;
  if(hit(t,['exploration','exploratory','pre-pipeline','pre pipeline','early contact','first contact','initial contact','possible opportunity','topic exploration','exploracion','exploración','exploratorio','contacto inicial','primer contacto','posible oportunidad','exploração','exploratório','primeiro contato','contato inicial','possivel oportunidade','possível oportunidade'])>0) return 'exploration';
  if(hit(t,['concept review','concept note','screening','sourcing','prospection','prospeccion','prospecção','diligence','diligencia','investment committee','comite de inversion','comité de inversión','comite de investimento','application review','investment memo','legal due diligence'])>0) return 'pipeline';
  if(hit(t,['portfolio','portafolio','carteira','active investment','investment agreement','grant agreement','disbursement','desembolso','onboarding','follow-on','renewal','renewal decision'])>0) return 'portfolio';
  if(hit(t,['venture building','incubation','incubacion','incubação','spin-off','spinoff','validation','validacion','validação'])>0) return 'venture';
  if(hit(t,['in-house','in house','program operated by ver+','operado por ver+','operado pela ver+','beneficiary data','participant data','datos de beneficiarios','dados de beneficiarios'])>0) return 'inhouse';
  if(hit(t,['board','leadership team','all team','offsite','policy','politica','research','investigacion','pesquisa','external report','paper','benchmark','template','plantilla','modelo','finance','legal','people','tech','charity','ecosystem','co-investor','coinvestor'])>0) return 'institutional';
  return 'auto';
}

/* ─── Routing ─────────────────────────────────────────────── */

export function route(text, suppliedObject, selectedContext, selectedTheme){
  const t=norm(text);
  const object=inferObject(text,suppliedObject);
  let context=inferContext(t,selectedContext,object);
  let theme=inferTheme(t,selectedTheme);
  const objectNorm=norm(object);
  let special=null;
  if(objectNorm.includes('beca tech') || t.includes('beca tech')) special='beca';
  if(objectNorm.includes('democracia+') || t.includes('democracia+')) special='democracia';
  if(objectNorm.includes('emergency response') || objectNorm.includes('emergency_response') || t.includes('emergency response')) special='emergency';
  if(special==='beca'){ context='inhouse'; theme='Education'; }
  if(special==='democracia'){ context='venture'; theme='Democracy'; }
  if(special==='emergency'){ context='inhouse'; theme=CROSS_THEMATIC; }
  const year=String(new Date().getFullYear());
  const obj=slug(object);
  /**
   * Theme resolved once per permitted set (v06 design rule 2). `coreTheme` is for locations
   * the canonical tree keeps to Education/Democracy; `crossTheme` for the ones that also
   * define Cross_Thematic.
   */
  const coreTheme=themeFor(THEMES, theme);
  const crossTheme=themeFor(THEMES_WITH_CROSS_THEMATIC, theme);
  const candidates=[];
  const add=(score,path,docType,why,needs=[],title='')=>candidates.push({score,path,docType,why,needs,title});
  const kw=(arr,w=1)=>hit(t,arr)*w;

  add(kw(['declined','rejected','withdrawn','no avanzo','no avanzó','rechazado','retirado','recusado','nao avancou','não avançou'],7),`99_ARCHIVE/01_Declined_Pipeline/${obj}`,'Decline_Record','This is documentation for an opportunity that did not advance.',['object']);
  add(kw(['closed portfolio','investment ended','relationship ended','cerrado portafolio','relacion termino','relação encerrou'],7),`99_ARCHIVE/02_Closed_Portfolio/${coreTheme}/${obj}`,'Closure_Record','The active Portfolio relationship has ended. Closed Portfolio is organized by theme.',['object', ...themeNeeds(coreTheme)]);
  add(kw(['closed venture','venture closed','incubation ended','venture cerrado','venture encerrado'],7),`99_ARCHIVE/03_Closed_Ventures/${coreTheme}/${obj}`,'Closure_Record','The Venture Building initiative has ended. Closed Ventures is organized by theme.',['object', ...themeNeeds(coreTheme)]);
  add(kw(['closed in-house','program closed','programa cerrado','programa encerrado'],7),`99_ARCHIVE/04_Closed_In_House_Programs/${crossTheme}/${obj}`,'Closure_Record','The directly operated program has ended. Closed In-house Programs is organized into Education, Democracy, and Cross_Thematic.',['object', ...themeNeeds(crossTheme)]);
  add(kw(['superseded strategy','old strategy','estrategia reemplazada','estrategia substituida'],7),`99_ARCHIVE/05_Superseded_Strategies`,'Strategy_SUPERSEDED','This strategy has been replaced and is kept for traceability.');
  add(kw(['deprecated template','old template','plantilla obsoleta','modelo obsoleto'],7),`99_ARCHIVE/06_Deprecated_Templates`,'Template_SUPERSEDED','This reusable template should no longer be used.');
  add(kw(['legacy structure','old drive structure','estructura anterior','estrutura antiga'],7),`99_ARCHIVE/07_Legacy_Structure`,'Legacy_Record','This belongs to the read-only legacy structure.');
  add(kw(['old admin','historical admin','administrativo antiguo','administrativo antigo'],6),`99_ARCHIVE/08_Old_Admin_Docs`,'Administrative_Record','This administrative record is historical rather than active.');

  add(kw(['five-year plan','5 year plan','plan de cinco anos','plan de cinco años','plano de cinco anos'],7),`01_STRATEGY/01_ver+_Strategy/01_5_Year_Plan`,'5_Year_Plan','This defines the organization’s long-term institutional direction.');
  add(kw(['north star','investment thesis','tesis de inversion','tese de investimento'],8),`01_STRATEGY/01_ver+_Strategy/02_North_Star_and_Investment_Thesis`,'Investment_Thesis','North Star and Investment Thesis are institutional strategy documents.');
  add(kw(['approved strategy','estrategia aprobada','estrategia aprovada'],7),`01_STRATEGY/01_ver+_Strategy/03_Approved_Strategy`,'Strategy_APPROVED','This is a formally approved institutional strategy.');
  add(kw(['strategy draft','borrador de estrategia','rascunho de estrategia'],7),`01_STRATEGY/01_ver+_Strategy/99_Drafts`,'Strategy_DRAFT','Working strategy versions belong in the strategy drafts folder.');
  if(kw(['thematic strategy','estrategia tematica','estratégia temática','education strategy','democracy strategy'])>0){
    const stat=inferStatus(t)==='APPROVED'?'Approved':'99_Drafts';
    add(8,`01_STRATEGY/02_Thematic_Strategies/${coreTheme}/${stat}`,'Thematic_Strategy',`This is a thematic strategy for ${coreTheme}.`,themeNeeds(coreTheme));
  }
  if(kw(['okr','okrs','objective and key result','objetivos y resultados clave','objetivos e resultados chave'])>0){
    const area=kw(['institutional','institucional','organization-wide','organizacional'])>0?'01_Institutional':kw(['area','team','equipo','equipe'])>0?'02_Areas':'99_Drafts';
    add(8,`01_STRATEGY/03_OKRs/${year}/${area}`,'OKRs','OKRs are organized by year because a new cycle is defined annually.');
  }

  if(kw(['policy','politica','política','procedure policy','organizational policy'])>0){
    const status=inferStatus(t);
    let sub='99_Drafts';
    if(status==='APPROVED'||status==='SIGNED') sub='01_Approved';
    if(kw(['guidance','guide','faq','guideline','procedimiento','orientacion','orientação','guia','instruccion','instrução'])>0) sub='02_Supporting_Guidance';
    add(8,`03_INSTITUTIONAL/00_POLICIES/${obj}/${sub}`,'Policy','Organization-wide policies and their guidance live together under Policies.',['object']);
  }

  const governance=[
    ['board',['board','junta directiva','consejo','conselho'],`03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/01_Board/${year}`,'Board_Meeting'],
    ['leadership',['leadership team','equipo de liderazgo','time de lideranca','time de liderança'],`03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/02_Leadership_Team/${year}`,'Leadership_Team_Meeting'],
    ['allteam',['all team','all hands','reunion de todo el equipo','reunião de toda a equipe'],`03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/03_All_Team/${year}`,'All_Team_Meeting'],
    ['offsite',['offsite','retiro institucional','retreat'],`03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/04_Offsites/${year}`,'Offsite']
  ];
  for(const [,words,path,type] of governance){
    const s=kw(words,7);
    if(s){
      let sub='';
      if(kw(['agenda'],2)) sub='/01_Agenda';
      else if(kw(['pre-read','preread','pre read','lectura previa','leitura previa'],2)) sub='/02_PreReads';
      else if(kw(['deck','presentation','presentacion','apresentacao','apresentação'],2)) sub='/03_Deck';
      else if(kw(['minutes','notes','acta','notas','ata'],2)) sub='/04_Notes_and_Minutes';
      else if(kw(['decision','action','acuerdo','acciones','decisao','decisão','acoes','ações'],2)) sub='/05_Decisions_and_Actions';
      add(s+4,path+`/${today()}_${type}`+sub,type,'This is a formal institutional governance meeting.');
    }
  }
  add(kw(['weekly email','weekly update','weekly newsletter','weekly digest','correo semanal','email semanal','boletin semanal','boletín semanal','e-mail semanal','informativo semanal'],12),`03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/05_Weekly_Email`,'Weekly_Email','The recurring weekly email package has one institutional home, restricted to the Leadership Team. Documents that already have an official RADAR home stay there and are linked rather than duplicated.');
  add(kw(['decision log','registro de decisiones','registro de decisoes','registro de decisões'],8),`03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/00_Decision_Log`,'Decision_Log','Material institutional decisions are indexed in the central Decision Log.');

  if(kw(['concept review','revision de concepto','revisión de concepto','revisao de conceito','revisão de conceito'])>0){
    let sub='';
    if(kw(['pre-read','preread','deck','presentation','memo','material'],2)) sub='/01_PreReads_and_Deck';
    else if(kw(['notes','minutes','acta','notas','ata'],2)) sub='/02_Notes_and_Minutes';
    else if(kw(['decision','next steps','acuerdo','siguientes pasos','decisao','proximos passos'],2)) sub='/03_Decision_and_Next_Steps';
    add(20,`02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/${coreTheme}/${obj}/03_Screening/02_Concept_Review/${today()}_Concept_Review${sub}`,'Concept_Review','Concept Review is a project-level gate inside Screening, not a central Governance meeting.',['object', ...themeNeeds(coreTheme)]);
  }
  if(kw(['investment committee','comite de inversion','comité de inversión','comite de investimento','comitê de investimento'])>0){
    let sub='';
    if(kw(['pre-read','preread','memo','deck','presentation','material'],2)) sub='/01_PreReads_and_Memo';
    else if(kw(['notes','minutes','acta','notas','ata'],2)) sub='/02_Notes_and_Minutes';
    else if(kw(['decision','next steps','acuerdo','siguientes pasos','decisao','proximos passos'],2)) sub='/03_Decision_and_Next_Steps';
    add(21,`02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/${coreTheme}/${obj}/04_Diligence/01_Investment_Due_Diligence/04_Investment_Committee/${today()}_Investment_Committee${sub}`,'Investment_Committee','Investment Committee is a project-level investment gate inside Investment Due Diligence.',['object', ...themeNeeds(coreTheme)]);
  }

  if(context==='exploration' || kw(['exploration','exploratory','pre-pipeline','early contact','possible opportunity','exploracion','exploración','exploratorio','contacto inicial','primer contacto','exploração','exploratório','primeiro contato','contato inicial'])>0){
    add(5+(context==='exploration'?6:0)+kw(['exploration','exploratory','early contact','first contact','possible opportunity','background','granola','notes','exploracion','exploración','contacto inicial','exploração','primeiro contato'],3),`02_INVESTMENTS_AND_PROGRAMS/0A_EXPLORATION/${crossTheme}/${obj}`,'Exploration_Material','This is substantive pre-Pipeline work. It stays in Exploration until it becomes a formal opportunity, at which point the canonical Pipeline structure is created and this material moves into it.',['object', ...themeNeeds(crossTheme)]);
  }

  if(context==='pipeline' || kw(['sourcing','screening','diligence','diligencia','opportunity','oportunidad','oportunidade','prospection','prospeccion','prospecção'])>0){
    const base=`02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/${coreTheme}/${obj}`;
    add(4+(context==='pipeline'?5:0)+kw(['overview','contact','contacts','contacto','contato'],2),`${base}/00_Overview_and_Contacts`,'Overview','This summarizes the opportunity and key contacts.',['object', ...themeNeeds(coreTheme)]);
    add(4+(context==='pipeline'?5:0)+kw(['meeting','reunion','reunião','call','llamada','chamada','granola','ai notes','notas automaticas','notas automáticas'],2),`${base}/01_Meetings/${year}_${obj}_Meeting_Log`,'Meeting_Notes','General relationship meetings are kept in the object’s yearly living Meeting Log.',['object', ...themeNeeds(coreTheme)]);
    if(kw(['granola','raw notes','transcript','transcripcion','transcrição','ai notes','automatic notes'])>0) add(13,`${base}/01_Meetings/Raw_Notes/${year}`,'Raw_Meeting_Notes','Raw Granola/AI notes are retained separately from the curated Meeting Log.',['object']);
    add(5+(context==='pipeline'?4:0)+kw(['sourcing','prospection','prospeccion','prospecção','intro','initial fit','pitch'],3),`${base}/02_Sourcing`,'Sourcing_Note','Initial opportunity information and fit assessment belong in Sourcing.',['object']);
    add(5+(context==='pipeline'?4:0)+kw(['screening','concept note','nota conceptual','nota de conceito','strategic fit','fit estrategico'],3),`${base}/03_Screening/01_Concept_Note_and_Materials`,'Concept_Note','Structured screening and concept materials belong in Screening.',['object']);
    add(5+(context==='pipeline'?4:0)+kw(['application','aplicacion','aplicação','proposal form'],3),`${base}/04_Diligence/01_Investment_Due_Diligence/01_Application`,'Application','The formal investment application belongs in Investment Due Diligence.',['object']);
    add(5+(context==='pipeline'?4:0)+kw(['application review','revision de aplicacion','revisión de aplicación','revisao da aplicacao','revisão da aplicação'],3),`${base}/04_Diligence/01_Investment_Due_Diligence/02_Application_Review`,'Application_Review','The review of the formal application belongs in Investment Due Diligence.',['object']);
    add(5+(context==='pipeline'?4:0)+kw(['investment memo','memo de inversion','memorando de investimento','peer reviewed memo','peer-reviewed memo'],3),`${base}/04_Diligence/01_Investment_Due_Diligence/03_Peer_Reviewed_Investment_Memo`,'Investment_Memo','The peer-reviewed investment memo belongs in Investment Due Diligence.',['object']);
    add(5+(context==='pipeline'?4:0)+kw(['legal due diligence','legal diligence','diligencia legal'],4),`${base}/04_Diligence/02_Legal_Due_Diligence`,'Legal_Due_Diligence','Project-specific legal diligence stays with the opportunity.',['object']);
  }

  if(context==='portfolio'){
    const base=`02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/${coreTheme}/${obj}`;
    const common=8;
    add(common+kw(['overview','contact','contacts','contacto','contato'],2),`${base}/00_Overview_and_Contacts`,'Overview','This is core reference information for an active Portfolio organization.',['object']);
    add(common+kw(['meeting','reunion','reunião','call','llamada','chamada','granola'],2),`${base}/01_Meetings/${year}_${obj}_Meeting_Log`,'Meeting_Notes','General relationship meetings belong in the organization’s yearly Meeting Log.',['object']);
    if(kw(['granola','raw notes','transcript','transcripcion','transcrição','ai notes'])>0) add(16,`${base}/01_Meetings/Raw_Notes/${year}`,'Raw_Meeting_Notes','Raw meeting notes are retained separately from the curated Meeting Log.',['object']);
    add(common+kw(['onboarding','kickoff','kick-off','start-up plan','plan de inicio','plano de inicio'],3),`${base}/05_Onboarding`,'Onboarding','Start-up and onboarding materials belong here.',['object']);
    add(common+kw(['investment agreement','grant agreement','contract','contrato','amendment','adenda','investment docs','documentos de inversion','documentos de investimento'],3),`${base}/06_Investment_Docs`,'Investment_Document','Executed investment documents and amendments belong here.',['object']);
    add(common+kw(['execution','implementation','work plan','plan de trabajo','plano de trabalho','milestone','hito','deliverable','entregable','entregavel'],3),`${base}/07_Execution`,'Execution_Document','Operational execution, work plans, milestones, and deliverables belong here.',['object']);
    add(common+kw(['disbursement','desembolso','payment request','solicitud de desembolso','pedido de desembolso'],4),`${base}/08_Disbursements`,'Disbursement','Investment-specific disbursement traceability belongs here.',['object']);
    add(common+kw(['report','informe','relatorio','relatório','progress report','financial report','narrative report'],2),`${base}/09_Reports`,'Report','Formal reports submitted by or about the organization belong here.',['object']);
    add(common+kw(['evaluation','evaluacion','avaliação','survey','encuesta','pesquisa de campo','dataset','data set','indicator','indicador','mel','theory of change','teoria de cambio','teoria de mudança','evidence','evidencia'],3),`${base}/10_MEL_Evidence`,'MEL_Evidence','Object-specific evidence, data, evaluations, indicators, and MEL materials stay with the Portfolio organization.',['object']);
    add(common+kw(['photo','photos','foto','fotos','video','videos','vídeo','vídeos','audiovisual'],5),`${base}/11_Photos_and_Videos`,'Photo_or_Video','Photos and videos for a Portfolio organization have an official object-specific home.',['object']);
    add(common+kw(['decision','transition','renewal','exit','continuity','renovacion','renovação','salida','saida','saída'],3),`${base}/12_Decisions_and_Transitions`,'Decision_or_Transition','Continuity, renewal, transition, and exit decisions belong here.',['object']);
  }

  if(context==='venture'){
    const special=norm(object).includes('democracia+')||t.includes('democracia+');
    const base=special?`02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Democracy/Democracia+`:`02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/${coreTheme}/${obj}`;
    const common=8;
    add(common+kw(['overview','governance','gobernanza','governanca','governança'],2),`${base}/00_Overview_and_Governance`,'Overview','Core overview and governance for the venture belong here.',['object']);
    add(common+kw(['meeting','reunion','reunião','call','granola'],2),`${base}/01_Meetings/${year}_${special?'Democracia+':obj}_Meeting_Log`,'Meeting_Notes','General venture meetings belong in the yearly Meeting Log.',['object']);
    if(kw(['granola','raw notes','transcript','transcripcion','transcrição','ai notes'])>0) add(16,`${base}/01_Meetings/Raw_Notes/${year}`,'Raw_Meeting_Notes','Raw meeting notes are retained separately from the curated Meeting Log.',['object']);
    if(special){
      const primaryDemocracia = objectNorm.includes('democracia+');
      if(!primaryDemocracia){
        add(19+kw(['subportfolio','organization','organizacion','organização','managed through','managed by','gestionada','gestionado','gerida','gerido','dentro de'],2),`${base}/04_Subportfolio_and_Organizations/${obj}`,'Democracia+_Subportfolio_Record','Because the named organization is managed through Democracia+, its official home is inside Democracia+ / Subportfolio_and_Organizations.',['object']);
      }
      add(common+kw(['strategy','model','estrategia','modelo'],3),`${base}/02_Strategy_and_Model`,'Strategy_and_Model','Democracia+ uses the expanded venture structure for strategy and model materials.');
      add(common+kw(['operation','operations','operacion','operación','operacoes','operações'],3),`${base}/03_Operations`,'Operations','Democracia+ operational materials belong here.');
      add(common+kw(['subportfolio','organization','organizacion','organização','grantee','investment'],2),`${base}/04_Subportfolio_and_Organizations/${obj==='Democracia+'?'[Organization_Name]':obj}`,'Subportfolio_Record','Organizations managed inside Democracia+ are stored in its subportfolio structure.');
      add(common+kw(['finance','legal','budget','presupuesto','orcamento','orçamento','contract'],3),`${base}/05_Finance_and_Legal`,'Finance_and_Legal','Democracia+ finance and legal materials belong here.');
      add(common+kw(['mel','evaluation','evaluacion','avaliação','learning','aprendizaje','aprendizagem','evidence'],4),`${base}/06_MEL_and_Learning`,'MEL_and_Learning','Democracia+ evidence and learning belong here.');
      add(common+kw(['comms','communication','comunicacion','comunicação','report','informe','relatorio'],3),`${base}/07_Comms_and_Reports`,'Comms_or_Report','Communications and reports belong here.');
      add(common+kw(['partner','partners','socio','aliado','parceiro','co-investor','coinvestor'],3),`${base}/08_Partners_and_Co_Investors`,'Partner_Record','Partners and co-investors linked to Democracia+ belong here.');
      add(common+kw(['photo','foto','video','vídeo','audiovisual'],5),`${base}/09_Photos_and_Videos`,'Photo_or_Video','Democracia+ photos and videos have a dedicated folder.');
      add(common+kw(['spinoff','spin-off','independence','independencia','externalization','externalizacion','externalização'],4),`${base}/10_Spinoff_Preparation`,'Spinoff_Preparation','Materials preparing a potential spin-off belong here.');
    } else {
      add(common+kw(['design','structuring','diseno','diseño','estructuracion','estruturação','business model','operating model'],3),`${base}/02_Design_and_Structuring`,'Design_and_Structuring','Problem definition, design, and structuring belong here.',['object']);
      add(common+kw(['validation','pilot','piloto','test','prueba','teste'],3),`${base}/03_Validation`,'Validation','Tests, pilots, and validation materials belong here.',['object']);
      add(common+kw(['implementation','implementacion','implementação','operation','operacion','operação'],3),`${base}/04_Implementation`,'Implementation','Implementation and execution materials belong here.',['object']);
      add(common+kw(['mel','evaluation','evaluacion','avaliação','learning','aprendizaje','aprendizagem','metric','metrica','métrica'],3),`${base}/05_MEL_and_Learning`,'MEL_and_Learning','Evidence, metrics, experiments, and learning used to improve the venture belong here.',['object']);
      add(common+kw(['finance','legal','budget','presupuesto','orcamento','orçamento'],3),`${base}/06_Finance_and_Legal`,'Finance_and_Legal','Venture-specific finance and legal materials belong here.',['object']);
      add(common+kw(['partner','provider','contract','socio','proveedor','parceiro','fornecedor'],3),`${base}/07_Partners_and_Contracts`,'Partners_and_Contracts','Partner and contract materials specific to the venture belong here.',['object']);
      add(common+kw(['comms','communication','comunicacion','comunicação','report','informe','relatorio'],3),`${base}/08_Comms_and_Reports`,'Comms_or_Report','Venture communications and reports belong here.',['object']);
      add(common+kw(['photo','foto','video','vídeo','audiovisual'],5),`${base}/09_Photos_and_Videos`,'Photo_or_Video','Venture photos and videos have an official object-specific home.',['object']);
      add(common+kw(['spinoff','spin-off','transition','transicion','transição','externalization','externalizacion','externalização'],4),`${base}/10_Spinoff_or_Transition`,'Spinoff_or_Transition','Materials for spin-off, externalization, or transition belong here.',['object']);
    }
  }

  if(context==='inhouse'){
    const specialBeca=special==='beca';
    /**
     * v06 SPECIAL CASE - EMERGENCY RESPONSE. Cross_Thematic because ver+ operates the work
     * directly and it does not sit naturally under Education or Democracy; it uses the
     * standard In-house Program template with no changes.
     */
    const specialEmergency=special==='emergency';
    const base=specialBeca
      ? `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech`
      : specialEmergency
        ? `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/${CROSS_THEMATIC}/Emergency_Response`
        : `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/${crossTheme}/${obj}`;
    /**
     * In-house Programs is one of the areas v06 defines Cross_Thematic in, so the theme can
     * legitimately be it. The two fixed-name special cases already know their own theme.
     */
    const nd=(specialBeca||specialEmergency)?['object']:['object', ...themeNeeds(crossTheme)];
    const common=8;
    add(common+kw(['overview','governance','gobernanza','governanca','governança'],2),`${base}/00_Overview_and_Governance`,'Overview','Core overview and governance for the in-house program belong here.',nd);
    add(common+kw(['meeting','reunion','reunião','call','granola'],2),`${base}/01_Meetings/${year}_${specialBeca?'Beca_Tech':specialEmergency?'Emergency_Response':obj}_Meeting_Log`,'Meeting_Notes','General program meetings belong in the yearly Meeting Log.',nd);
    if(kw(['granola','raw notes','transcript','transcripcion','transcrição','ai notes'])>0) add(16,`${base}/01_Meetings/Raw_Notes/${year}`,'Raw_Meeting_Notes','Raw meeting notes are retained separately from the curated Meeting Log.',nd);
    add(common+kw(['strategy','design','estrategia','diseno','diseño','desenho','model'],3),`${base}/02_Strategy_and_Design`,'Strategy_and_Design','Program strategy and design belong here.',nd);
    add(common+kw(['operations','operation','operacion','operación','operacao','operação','implementation'],3),`${base}/03_Operations`,'Operations','Day-to-day operating and implementation materials belong here.',nd);
    if(specialBeca) add(common+kw(['application','applications','applicant','selection','seleccion','seleção','cohort management','gestion de cohortes','gestión de cohortes','gestao de coortes','gestão de coortes','scholarship process','program delivery','implementacion del programa','implementação do programa'],4),`${base}/03_Operations`,'Beca_Tech_Operations','Beca Tech is a high-volume In-house Program. Applications, selection, cohort management, and program implementation stay under Operations; organize by year/cohort when useful.');
    add(common+kw(['partner','provider','vendor','socio','aliado','proveedor','parceiro','fornecedor'],3),`${base}/04_Partners_and_Providers`,'Partners_and_Providers','Partners and providers directly supporting the program belong here.',nd);
    add(common+kw(['participant','beneficiary','participants','beneficiaries','participante','beneficiario','beneficiário','personal data','datos personales','dados pessoais','participant data','participant database','beneficiary database','base de participantes','base de beneficiarios','dados de participantes','dados de beneficiarios'],5),`${base}/05_Participants_and_Beneficiary_Data`,'Participant_Data',specialBeca?'Beca Tech participant and beneficiary records belong in the restricted Beca Tech data folder; organize high-volume records by year/cohort when useful.':'Participant/beneficiary data belongs in the restricted program folder.',nd);
    add(common+kw(['mel','evaluation','evaluacion','avaliação','survey','encuesta','dataset','indicator','evidence','evidencia'],3),`${base}/06_MEL_Evidence`,'MEL_Evidence',specialBeca?'Beca Tech indicators, datasets, monitoring, evaluations, results, and evidence belong here; organize by study/evaluation or cohort when useful.':'Program-specific evidence, data, evaluations, and indicators belong here.',nd);
    add(common+kw(['finance','legal','budget','presupuesto','orcamento','orçamento','contract'],3),`${base}/07_Finance_and_Legal`,'Finance_and_Legal','Program-specific finance and legal records belong here.',nd);
    add(common+kw(['comms','communication','comunicacion','comunicação','report','informe','relatorio'],3),`${base}/08_Comms_and_Reports`,'Comms_or_Report','Program communications and reports belong here.',nd);
    add(common+kw(['photo','photos','foto','fotos','video','videos','vídeo','vídeos','audiovisual'],5),`${base}/09_Photos_and_Videos`,'Photo_or_Video',specialBeca?'Beca Tech photos and videos belong here; organize large volumes by year, event, or cohort and use shortcuts for institutional Comms.':'Program photos and videos have an official object-specific home.',nd);
    add(common+kw(['decision','transition','closure','continuity','decision','transicion','transição','cierre','encerramento'],3),`${base}/10_Decisions_and_Transitions`,'Decision_or_Transition','Material program decisions and transitions belong here.',nd);
  }

  add(kw(['master registry','master index','opportunity map','active portfolio view','registry','registro maestro','registro mestre','mapa de oportunidades'],7),`02_INVESTMENTS_AND_PROGRAMS/00_MASTER_INDEXES/00_Master_Registry`,'Master_Registry','RADAR uses one canonical Master Registry; other indexes are automated views.');

  const trans=[
    ['Charity',['charity'],`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Charity`,'Charity_Record'],
    ['Comms',['comms','communications','communication','comunicacion','comunicação','brand','marca','press','prensa','imprensa','social media','redes sociales','midias sociais','mídias sociais','campaign','campana','campanha'],`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Comms`,'Comms_Record'],
    ['Finance',['institutional finance','accounting','contabilidad','contabilidade','corporate budget','presupuesto institucional','orcamento institucional','orçamento institucional','financial close','cierre financiero','fechamento financeiro'],`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Finance`,'Finance_Record'],
    ['Ops',['ops admin','administration','administracion','administração','institutional provider','proveedor institucional','fornecedor institucional','operating procedure','procedimiento operativo','procedimento operacional'],`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Ops_Admin`,'Ops_Admin_Record'],
    ['People',['people','human resources','recursos humanos','hiring','contratacion','contratação','performance review','desempeno','desempenho','culture','cultura','employee onboarding'],`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/People`,'People_Record'],
    ['Tech',['tech','technology','tecnologia','automation','automatizacion','automação','system documentation','documentacion de sistemas','documentação de sistemas','it support','soporte tecnico','suporte tecnico'],`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Tech`,'Tech_Record']
  ];
  for(const [name,words,path,type] of trans) add(kw(words,6)+(context==='institutional'?2:0),path,type,`This is an organization-wide ${name} record or process.`);
  add(kw(['bylaws','estatuto','articles of incorporation','corporate registration','registro societario','registro societário','legal entity','entidad legal','entidade legal','entity governance'],7),`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Legal/Entities_and_Governance`,'Legal_Entity_Record','Institutional entity and governance documents belong in Legal / Entities and Governance.');
  add(kw(['contract template','agreement template','plantilla de contrato','modelo de contrato','template de contrato'],8),`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Legal/Contract_Templates`,'Contract_Template','Reusable legal templates belong in Institutional Legal, not with a completed project contract.');
  add(kw(['regulatory framework','marco regulatorio','estrutura regulatoria','estrutura regulatória','legal analysis','analisis legal','análise jurídica'],7),`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Legal/Regulatory_Frameworks`,'Regulatory_Framework','Institutional regulatory frameworks and legal analyses belong here.');
  add(kw(['institutional legal','legal institutional','legal institucional'],6)+(context==='institutional'?2:0),`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Legal`,'Legal_Record','This is an organization-wide Legal record.');
  add(kw(['mel methodology','mel method','methodology','metodologia','standard instrument','instrumento estandar','instrumento padrão','indicator dictionary','diccionario de indicadores','dicionario de indicadores','mel framework','evaluation framework','marco de evaluacion','framework de avaliacao','data protocol','protocolo de datos','protocolo de dados'],7)+(context==='institutional'?2:0),`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/MEL`,'MEL_Methodology','Reusable organization-wide MEL systems, methods, instruments, indicator frameworks, and guidance belong in Transversal Areas / MEL.');

  if(kw(['research project','investigacion','investigación','pesquisa','study by ver+','estudio de ver+','estudo da ver+','we produced','produced by ver+'])>0 && kw(['external','third party','world bank','unicef','unesco','oecd','banco mundial','terceiro'])===0){
    // 01_Research_Projects is Education | Democracy | Institutional — never Cross_Thematic.
    add(11,`03_INSTITUTIONAL/03_RESEARCH_AND_LEARNING/01_Research_Projects/${isPlaceholder(coreTheme)?'Institutional':coreTheme}/${obj}`,'Research_Project','This is standalone research produced by ver+ with its own question, method, analysis, and deliverables.');
  }
  const explicitLearning=kw(['learning product','learning brief','synthesis','sintesis','síntesis','sintese','síntese','lessons learned','lecciones aprendidas','licoes aprendidas','lições aprendidas']);
  const crossObjectLearning=kw(['cross-investment','across investments','varias inversiones','varios investimentos'])>0 && kw(['learning','aprendizaje','aprendizagem','synthesis','sintesis','síntesis','sintese','síntese','lessons','lecciones','licoes','lições'])>0;
  if(explicitLearning>0 || crossObjectLearning){
    const th=kw(CROSS_THEMATIC_WORDS,2)>0?CROSS_THEMATIC:crossTheme;
    add(11,`03_INSTITUTIONAL/03_RESEARCH_AND_LEARNING/02_Learning_Products/${th}`,'Learning_Product','This synthesizes learning across objects or addresses a broader thematic/institutional question.',themeNeeds(th));
  }

  if(kw(['ecosystem map','ecosystem mapping','ecosystem architecture','mapa de actores','mapeo de actores','mapeamento de atores','landscape scan','network analysis','analisis de red','análise de rede','capability gap','brecha de capacidades'])>0)
    add(12,`03_INSTITUTIONAL/04_ECOSYSTEM_AND_PARTNERSHIPS/01_Ecosystem_Architecture/${coreTheme}`,'Ecosystem_Analysis','Ecosystem analyses produced by ver+ are organized by Education or Democracy.',themeNeeds(coreTheme));
  if(kw(['potential co-investor','potential coinvestor','co-investor mapping','mapeo de coinversionistas','mapeamento de coinvestidores'])>0)
    add(12,`03_INSTITUTIONAL/04_ECOSYSTEM_AND_PARTNERSHIPS/02_Co_Investors/Mapping`,'Co_Investor_Profile','Potential co-investors under exploration belong in Mapping.');
  if(kw(['active co-investor','active coinvestor','co-investment agreement','acuerdo de coinversion','acordo de coinvestimento','joint investment','inversion conjunta','investimento conjunto'])>0)
    add(12,`03_INSTITUTIONAL/04_ECOSYSTEM_AND_PARTNERSHIPS/02_Co_Investors/Active/${obj}`,'Co_Investor_Record','Active co-investor relationships and joint opportunities belong here.',['object']);

  if(kw(['external','third-party','third party','paper','academic paper','world bank','banco mundial','unicef','unesco','oecd','external report','informe externo','relatorio externo','relatório externo','benchmark','best practice','external dataset','estudio externo','estudo externo'])>0){
    // Third-party material spanning more than one theme belongs in Cross_Thematic, so an
    // unresolved theme is a real destination here rather than a missing input.
    add(13,`03_INSTITUTIONAL/05_EXTERNAL_KNOWLEDGE/${isPlaceholder(crossTheme)?CROSS_THEMATIC:crossTheme}`,'External_Reference','This is reusable knowledge produced by a third party, so its official home is External Knowledge.');
  }

  if(kw(['template','plantilla','modelo reutilizable','modelo reutilizavel','modelo reutilizável','blank form','formato vacio','formato vazio','empty model','tor template','terms of reference template'])>0)
    add(14,`03_INSTITUTIONAL/06_TEMPLATES`,'Template','Empty reusable institutional models belong in Templates; completed versions go to the relevant object/process.');

  if(context==='auto'){
    const o=norm(object);
    for(const [name,meta] of Object.entries(knownObjects)){
      if(o.includes(norm(name))||t.includes(norm(name))){
        return route(text,object,meta.context,selectedTheme==='auto'?meta.theme:selectedTheme);
      }
    }
  }

  if(context==='institutional') add(3,`03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/[Select_Function]`,'Institutional_Document','The description appears institutional, but more detail is needed to identify the exact institutional subfolder.',['context']);
  if(context==='auto') add(1,`[More information needed]`,'Document','The description does not yet identify the main object or process clearly enough.',['context','object']);

  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  const second=candidates[1];
  const gap=best && second ? best.score-second.score : best?.score||0;
  let conf='low';
  if(best && best.score>=13 && gap>=3) conf='high';
  else if(best && best.score>=7) conf='medium';
  if(best && best.path.includes('[More information')) conf='low';
  return {best, alternatives:candidates.slice(1,4).filter(x=>x.score>=Math.max(4,(best?.score||0)-5)), confidence:conf, object, theme, context, special, lang:detectLanguage(text)};
}

/* ─── Naming + translation ────────────────────────────────── */

function documentTypeLabel(type){
  return (type||'Document').replace(/_APPROVED|_DRAFT|_SUPERSEDED/g,'');
}
function suggestedName(res, text){
  const status=inferStatus(norm(text));
  const type=documentTypeLabel(res.best.docType);
  let object=slug(res.object);
  if(object==='[Object]' && ['External_Reference','Template','Decision_Log','MEL_Methodology'].includes(type)) object= type==='External_Reference' ? 'External_Knowledge' : type==='MEL_Methodology' ? 'MEL' : 'Institutional';
  return `${today()}_${object}_${type}_${status}_v01`;
}
function translateWhy(why,lang){
  if(lang==='en') return why;
  const es={
    'Concept Review is a project-level gate inside Screening, not a central Governance meeting.':'Concept Review es un hito del proyecto dentro de Screening, no una reunión de Governance central.',
    'Investment Committee is a project-level investment gate inside Investment Due Diligence.':'Investment Committee es un hito de inversión del proyecto dentro de Investment Due Diligence.',
    'This is reusable knowledge produced by a third party, so its official home is External Knowledge.':'Es conocimiento reutilizable producido por un tercero, por lo que su hogar oficial es External Knowledge.',
    'Reusable organization-wide MEL systems, methods, instruments, indicator frameworks, and guidance belong in Transversal Areas / MEL.':'Los sistemas, metodologías, instrumentos, marcos de indicadores y guías MEL reutilizables a nivel institucional van en Transversal Areas / MEL.',
    'Object-specific evidence, data, evaluations, indicators, and MEL materials stay with the Portfolio organization.':'La evidencia, datos, evaluaciones, indicadores y materiales MEL específicos de una organización se quedan con esa organización de Portfolio.',
    'Photos and videos for a Portfolio organization have an official object-specific home.':'Las fotos y videos de una organización de Portfolio tienen una carpeta oficial dentro de esa organización.',
    'Organization-wide policies and their guidance live together under Policies.':'Las políticas institucionales y sus guías de aplicación viven juntas en Policies.',
    'Because the named organization is managed through Democracia+, its official home is inside Democracia+ / Subportfolio_and_Organizations.':'Como la organización indicada se gestiona a través de Democracia+, su hogar oficial está dentro de Democracia+ / Subportfolio_and_Organizations.',
    'Beca Tech is a high-volume In-house Program. Applications, selection, cohort management, and program implementation stay under Operations; organize by year/cohort when useful.':'Beca Tech es un In-house Program de alto volumen. Aplicaciones, selección, gestión de cohortes e implementación se guardan en Operations; organiza por año/cohorte cuando sea útil.',
    'Beca Tech participant and beneficiary records belong in the restricted Beca Tech data folder; organize high-volume records by year/cohort when useful.':'Los registros de participantes y beneficiarios de Beca Tech van en su carpeta de datos restringida; organiza los volúmenes altos por año/cohorte cuando sea útil.',
    'Beca Tech indicators, datasets, monitoring, evaluations, results, and evidence belong here; organize by study/evaluation or cohort when useful.':'Los indicadores, bases, monitoreo, evaluaciones, resultados y evidencia de Beca Tech van aquí; organiza por estudio/evaluación o cohorte cuando sea útil.',
    'Beca Tech photos and videos belong here; organize large volumes by year, event, or cohort and use shortcuts for institutional Comms.':'Las fotos y videos de Beca Tech van aquí; organiza grandes volúmenes por año, evento o cohorte y usa accesos directos para Comms institucional.'
  };
  const pt={
    'Concept Review is a project-level gate inside Screening, not a central Governance meeting.':'Concept Review é um marco do projeto dentro de Screening, não uma reunião de Governance central.',
    'Investment Committee is a project-level investment gate inside Investment Due Diligence.':'Investment Committee é um marco de investimento do projeto dentro de Investment Due Diligence.',
    'This is reusable knowledge produced by a third party, so its official home is External Knowledge.':'É conhecimento reutilizável produzido por terceiros, portanto seu local oficial é External Knowledge.',
    'Reusable organization-wide MEL systems, methods, instruments, indicator frameworks, and guidance belong in Transversal Areas / MEL.':'Sistemas, metodologias, instrumentos, frameworks de indicadores e orientações MEL reutilizáveis em toda a organização ficam em Transversal Areas / MEL.',
    'Object-specific evidence, data, evaluations, indicators, and MEL materials stay with the Portfolio organization.':'Evidências, dados, avaliações, indicadores e materiais MEL específicos de uma organização permanecem com essa organização de Portfolio.',
    'Photos and videos for a Portfolio organization have an official object-specific home.':'Fotos e vídeos de uma organização de Portfolio têm uma pasta oficial dentro dessa organização.',
    'Organization-wide policies and their guidance live together under Policies.':'Políticas institucionais e suas orientações ficam juntas em Policies.',
    'Because the named organization is managed through Democracia+, its official home is inside Democracia+ / Subportfolio_and_Organizations.':'Como a organização indicada é gerida por meio de Democracia+, seu local oficial fica em Democracia+ / Subportfolio_and_Organizations.',
    'Beca Tech is a high-volume In-house Program. Applications, selection, cohort management, and program implementation stay under Operations; organize by year/cohort when useful.':'Beca Tech é um In-house Program de alto volume. Inscrições, seleção, gestão de coortes e implementação ficam em Operations; organize por ano/coorte quando útil.',
    'Beca Tech participant and beneficiary records belong in the restricted Beca Tech data folder; organize high-volume records by year/cohort when useful.':'Os registros de participantes e beneficiários da Beca Tech ficam na pasta restrita de dados; organize grandes volumes por ano/coorte quando útil.',
    'Beca Tech indicators, datasets, monitoring, evaluations, results, and evidence belong here; organize by study/evaluation or cohort when useful.':'Indicadores, bases, monitoramento, avaliações, resultados e evidências da Beca Tech ficam aqui; organize por estudo/avaliação ou coorte quando útil.',
    'Beca Tech photos and videos belong here; organize large volumes by year, event, or cohort and use shortcuts for institutional Comms.':'Fotos e vídeos da Beca Tech ficam aqui; organize grandes volumes por ano, evento ou coorte e use atalhos para Comms institucional.'
  };
  return (lang==='es'?es:pt)[why] || why;
}

/* ─── Public entry point ──────────────────────────────────── */

/**
 * @param {{ description: string, objectName?: string, context?: string, theme?: string }} input
 *   context: 'auto' | 'exploration' | 'pipeline' | 'portfolio' | 'venture' | 'inhouse'
 *            | 'institutional'
 *   theme:   'auto' | 'Education' | 'Democracy' | 'Cross_Thematic'
 *            (Cross_Thematic is honoured only where the canonical tree defines it)
 * @returns {{ language, title, path, filename, why, confidence, confidenceLabel,
 *   specialLabel, specialText, needsLabel, needs, alternativesLabel, alternatives }}
 * @throws {Error} with a user-facing message when the description is empty or unroutable.
 */
export function classifyRadar(input) {
  input = input || {};
  var text = String(input.description || '').trim();
  if (!text) throw new Error('Please describe what you want to save.');

  var suppliedObject = String(input.objectName || '');
  var context = String(input.context || 'auto');
  var theme = String(input.theme || 'auto');

  var res = route(text, suppliedObject, context, theme);
  if (!res || !res.best) throw new Error('RADAR could not identify a destination. Please add more context.');

  var L = ui[res.lang] || ui.en;
  var specialText = '';
  if (res.special && L[res.special]) specialText = L[res.special];

  var needs = [];
  if (res.object === '[Object]' && res.best.needs && res.best.needs.indexOf('object') >= 0) needs.push(L.object);
  if (res.context === 'auto' && res.best.needs && res.best.needs.indexOf('context') >= 0) needs.push(L.context);
  /**
   * The candidate decides this, not res.theme: theme validity is per location, so selecting
   * Cross_Thematic for a Pipeline object still leaves the theme unresolved for that path.
   */
  if (res.best.needs && res.best.needs.indexOf('theme') >= 0) needs.push(L.theme);

  var alternatives = (res.alternatives || []).filter(function(a){ return a.path !== res.best.path; }).map(function(a){
    return { title: String(a.docType || 'Document').replace(/_/g,' '), path: a.path };
  });

  return {
    language: res.lang,
    title: res.best.title || String(res.best.docType || 'Document').replace(/_/g,' '),
    path: res.best.path,
    filename: suggestedName(res, text),
    why: translateWhy(res.best.why, res.lang),
    confidence: res.confidence,
    confidenceLabel: L[res.confidence],
    specialLabel: L.specialLabel,
    specialText: specialText,
    needsLabel: L.need,
    needs: needs,
    alternativesLabel: L.alternatives,
    alternatives: alternatives
  };
}
