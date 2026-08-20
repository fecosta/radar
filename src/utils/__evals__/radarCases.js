// Each case: { description, objectName, context, theme, expectedPath, expectConfidence? }
// context: 'auto' | 'pipeline' | 'portfolio' | 'venture' | 'inhouse' | 'institutional'
// theme:   'auto' | 'Education' | 'Democracy' | 'Cross_Thematic'
// expectConfidence is asserted only when present (stable high/low cases).
export const evalCases = [
  { description: 'Board meeting minutes and decisions from our August board meeting', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/01_Board/2026/2026-06-15_Board_Meeting/04_Notes_and_Minutes' },
  { description: 'Necesito guardar las fotos del evento de Beca Tech de este año', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/09_Photos_and_Videos', expectConfidence: 'high' },
  { description: 'Ata da reunião do conselho (board) deste mês', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/01_Board/2026/2026-06-15_Board_Meeting/04_Notes_and_Minutes' },
  { description: 'Beca Tech applicant selection process for this cohort', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/03_Operations' },
  { description: 'draft', objectName: '', context: 'auto', theme: 'auto', expectedPath: '[More information needed]', expectConfidence: 'low' },
  { description: 'our five-year plan for the organization', objectName: '', context: 'auto', theme: 'auto', expectedPath: '01_STRATEGY/01_ver+_Strategy/01_5_Year_Plan' },
  { description: 'the North Star and investment thesis document', objectName: '', context: 'auto', theme: 'auto', expectedPath: '01_STRATEGY/01_ver+_Strategy/02_North_Star_and_Investment_Thesis', expectConfidence: 'high' },
  { description: 'institutional OKRs for this year', objectName: '', context: 'auto', theme: 'auto', expectedPath: '01_STRATEGY/03_OKRs/2026/01_Institutional' },
  { description: 'approved Education thematic strategy', objectName: '', context: 'auto', theme: 'Education', expectedPath: '01_STRATEGY/02_Thematic_Strategies/Education/Approved' },
  { description: 'approved organization-wide data privacy policy', objectName: 'Data Privacy', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/00_POLICIES/Data_Privacy/01_Approved' },
  { description: 'Leadership team meeting agenda', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/02_Leadership_Team/2026/2026-06-15_Leadership_Team_Meeting/01_Agenda' },
  { description: 'All hands all team meeting deck', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/03_All_Team/2026/2026-06-15_All_Team_Meeting/03_Deck' },
  { description: 'institutional offsite retreat notes', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/04_Offsites/2026/2026-06-15_Offsite/04_Notes_and_Minutes' },
  { description: 'the central decision log', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/00_Decision_Log' },
  { description: 'Concept Review deck for Fundacion Luminar', objectName: 'Fundacion Luminar', context: 'auto', theme: 'Education', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundacion_Luminar/03_Screening/02_Concept_Review/2026-06-15_Concept_Review/01_PreReads_and_Deck', expectConfidence: 'high' },
  { description: 'Investment Committee memo for Fundacion Luminar', objectName: 'Fundacion Luminar', context: 'auto', theme: 'Education', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundacion_Luminar/04_Diligence/01_Investment_Due_Diligence/04_Investment_Committee/2026-06-15_Investment_Committee/01_PreReads_and_Memo', expectConfidence: 'high' },
  { description: 'sourcing notes for a new opportunity', objectName: 'NewOrg', context: 'auto', theme: 'Education', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/NewOrg/02_Sourcing' },
  { description: 'legal due diligence for the opportunity', objectName: 'NewOrg', context: 'auto', theme: 'Education', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/NewOrg/04_Diligence/02_Legal_Due_Diligence' },
  { description: 'Aprendo+ evaluation report and MEL evidence', objectName: 'Aprendo+', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+/10_MEL_Evidence', expectConfidence: 'high' },
  { description: 'Aprendo+ onboarding kickoff materials', objectName: 'Aprendo+', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+/05_Onboarding' },
  { description: 'Democracia+ strategy and model document', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Democracy/Democracia+/02_Strategy_and_Model', expectConfidence: 'high' },
  { description: 'photos and videos for Democracia+', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Democracy/Democracia+/09_Photos_and_Videos' },
  { description: 'organization managed through Democracia+ subportfolio', objectName: 'CivicaLab', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Democracy/Democracia+/04_Subportfolio_and_Organizations/CivicaLab' },
  { description: 'Beca Tech participant beneficiary database', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/05_Participants_and_Beneficiary_Data', expectConfidence: 'high' },
  { description: 'the master registry of all opportunities', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/00_MASTER_INDEXES/00_Master_Registry', expectConfidence: 'high' },
  { description: 'organization-wide comms brand campaign', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Comms' },
  { description: 'institutional accounting and corporate budget financial close', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Finance' },
  { description: 'People HR hiring and performance review records', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/People' },
  { description: 'reusable MEL methodology and indicator dictionary', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/MEL' },
  { description: 'standalone research project produced by ver+', objectName: '', context: 'auto', theme: 'Education', expectedPath: '03_INSTITUTIONAL/03_RESEARCH_AND_LEARNING/01_Research_Projects/Education/[Object]' },
  { description: 'external World Bank report we keep as reference', objectName: '', context: 'auto', theme: 'Education', expectedPath: '03_INSTITUTIONAL/05_EXTERNAL_KNOWLEDGE/Education', expectConfidence: 'high' },
  { description: 'ecosystem mapping and architecture', objectName: '', context: 'auto', theme: 'Democracy', expectedPath: '03_INSTITUTIONAL/04_ECOSYSTEM_AND_PARTNERSHIPS/01_Ecosystem_Architecture/Democracy' },
  { description: 'blank reusable template model', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/06_TEMPLATES' },

  // ── v06 additions ───────────────────────────────────────────────────────────────────
  // 0A_EXPLORATION (design rule 18): substantive pre-Pipeline work.
  { description: 'early exploration notes on a possible opportunity', objectName: 'Fundacion Nueva', context: 'auto', theme: 'Education', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/0A_EXPLORATION/Education/Fundacion_Nueva', expectConfidence: 'high' },
  { description: 'exploratory topic research and background, a possible opportunity we have not taken to pipeline', objectName: 'Tema Nuevo', context: 'auto', theme: 'Cross_Thematic', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/0A_EXPLORATION/Cross_Thematic/Tema_Nuevo', expectConfidence: 'high' },
  // Emergency Response: a Cross_Thematic In-house Program, template unchanged.
  { description: 'Emergency Response operations plan for the flood response', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Cross_Thematic/Emergency_Response/03_Operations', expectConfidence: 'high' },
  { description: 'Emergency Response participant beneficiary database', objectName: '', context: 'auto', theme: 'auto', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Cross_Thematic/Emergency_Response/05_Participants_and_Beneficiary_Data', expectConfidence: 'high' },
  // WEEKLY EMAIL RULE: one institutional home, restricted to the Leadership Team.
  { description: 'weekly email package for the leadership team', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/05_Weekly email' },
  // Cross_Thematic where v06 already allowed it, now reachable by selection too.
  { description: 'cross-thematic learning product synthesis across education and democracy', objectName: '', context: 'auto', theme: 'auto', expectedPath: '03_INSTITUTIONAL/03_RESEARCH_AND_LEARNING/02_Learning_Products/Cross_Thematic' },
  // Archive sections 02/03/04 are theme-partitioned; only 04 admits Cross_Thematic.
  { description: 'closed portfolio because the investment ended', objectName: 'Aprendo Mas', context: 'auto', theme: 'Education', expectedPath: '99_ARCHIVE/02_Closed_Portfolio/Education/Aprendo_Mas', expectConfidence: 'high' },
  { description: 'this program closed and should be archived', objectName: 'Vivienda Digna', context: 'auto', theme: 'Cross_Thematic', expectedPath: '99_ARCHIVE/04_Closed_In_House_Programs/Cross_Thematic/Vivienda_Digna' },
  // Design rule 2: Cross_Thematic must never leak into a core-theme-only container. The
  // theme is reported as still needed rather than silently swapped for a core theme.
  { description: 'sourcing notes for a new opportunity', objectName: 'NewOrg', context: 'auto', theme: 'Cross_Thematic', expectedPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/[Education|Democracy]/NewOrg/02_Sourcing' },
];

// Cases where CURRENT output diverges from the SPEC-correct destination.
// Encoded so the test asserts the SPEC path and is expected to FAIL today (see test file).
// When the underlying bug is fixed, the test will start passing, which `it.fails` reports
// as a failure — prompting whoever fixed it to move the case into evalCases.
export const knownDivergences = [
  {
    description: 'Aprendo+ evaluation report and MEL evidence',
    objectName: '', context: 'auto', theme: 'auto',
    specExpectedPath: '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+/10_MEL_Evidence',
    currentPath: '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/aprendo+/10_MEL_Evidence',
    note: 'Known objects matched from FREE TEXT are lowercased (aprendo+), so the path does not match the canonical "Aprendo+" folder. Supplying the object name yields correct casing (see the passing Aprendo+ cases). Fix belongs in the classifier, not here.',
  },
  {
    description: 'application review notes',
    objectName: 'Sample Org', context: 'pipeline', theme: 'Education',
    specExpectedPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Sample_Org/04_Diligence/01_Investment_Due_Diligence/02_Application_Review',
    currentPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Sample_Org/04_Diligence/01_Investment_Due_Diligence/01_Application',
    note: 'Spec INVESTMENT PROCESS V2 -> FOLDER MAPPING routes "Application review" to 02_Application_Review. The 01_Application rule (keyword "application", weight 3) and the 02_Application_Review rule (keyword "application review", weight 3) both score 12 on this text, and the sort is stable, so the earlier-added 01_Application wins. Found by the canonical-model equivalence harness; the fix is a classifier tie-break, not a canonical change.',
  },
];
