import type { ApprovedChannelEntry, OfficialResourceLink } from '../types/muse';

export interface BoardDefinition {
  id: string;
  name: string;
  shortName: string;
  category: 'National' | 'State' | 'Senior Secondary' | 'Open';
  stateOrRegion: string;
  defaultLanguages: string[];
  syllabusAnchor: string;
  officialPortalUrl: string;
}

export interface LanguageDefinition {
  name: string;
  nativeLabel: string;
  bcp47: string;
  iso639_1: string;
}

export interface ClassStageDefinition {
  classLevel: number;
  label: string;
  stage: 'Primary' | 'Middle' | 'Secondary' | 'Senior Secondary';
  ageGroup: string;
  focus: string;
}

export const ALL_CLASS_LEVELS: ClassStageDefinition[] = [
  { classLevel: 1, label: 'Class 1', stage: 'Primary', ageGroup: '6–7 yrs', focus: 'Foundational Literacy, Phonics & Numbers' },
  { classLevel: 2, label: 'Class 2', stage: 'Primary', ageGroup: '7–8 yrs', focus: 'Early Reading, Addition/Subtraction & World Around Us' },
  { classLevel: 3, label: 'Class 3', stage: 'Primary', ageGroup: '8–9 yrs', focus: 'EVS, Multiplication/Division & Grammar' },
  { classLevel: 4, label: 'Class 4', stage: 'Primary', ageGroup: '9–10 yrs', focus: 'Fractions, Local Geography & Environmental Science' },
  { classLevel: 5, label: 'Class 5', stage: 'Primary', ageGroup: '10–11 yrs', focus: 'Primary Bridge: Science, Decimals & Social Awareness' },
  { classLevel: 6, label: 'Class 6', stage: 'Middle', ageGroup: '11–12 yrs', focus: 'Algebra Intro, Integrated Science & Ancient History' },
  { classLevel: 7, label: 'Class 7', stage: 'Middle', ageGroup: '12–13 yrs', focus: 'Geometry, Acids/Bases, Plant Biology & Civics' },
  { classLevel: 8, label: 'Class 8', stage: 'Middle', ageGroup: '13–14 yrs', focus: 'Linear Equations, Force & Pressure, Constitution' },
  { classLevel: 9, label: 'Class 9', stage: 'Secondary', ageGroup: '14–15 yrs', focus: 'Board Foundation: Physics, Chemistry, Biology & Euclidean Math' },
  { classLevel: 10, label: 'Class 10', stage: 'Secondary', ageGroup: '15–16 yrs', focus: 'Board Exams: Trigonometry, Life Processes, History & Writing' },
  { classLevel: 11, label: 'Class 11', stage: 'Senior Secondary', ageGroup: '16–17 yrs', focus: 'Streams (MPC/PCM, BiPC/PCB, Commerce, Humanities)' },
  { classLevel: 12, label: 'Class 12', stage: 'Senior Secondary', ageGroup: '17–18 yrs', focus: 'Senior Board & Entrance Prep: Calculus, Electrostatics & Economics' },
];

export const INDIAN_BOARDS: BoardDefinition[] = [
  {
    id: 'CBSE',
    name: 'CBSE (Central Board of Secondary Education)',
    shortName: 'CBSE',
    category: 'National',
    stateOrRegion: 'All India (NCERT Aligned)',
    defaultLanguages: ['English', 'Hindi', 'Sanskrit'],
    syllabusAnchor: 'NCERT',
    officialPortalUrl: 'https://cbseacademic.nic.in/',
  },
  {
    id: 'ICSE',
    name: 'ICSE (CISCE Classes 1–10)',
    shortName: 'ICSE',
    category: 'National',
    stateOrRegion: 'All India',
    defaultLanguages: ['English', 'Hindi'],
    syllabusAnchor: 'CISCE',
    officialPortalUrl: 'https://cisce.org/',
  },
  {
    id: 'ISC',
    name: 'ISC (CISCE Classes 11–12)',
    shortName: 'ISC',
    category: 'Senior Secondary',
    stateOrRegion: 'All India',
    defaultLanguages: ['English', 'Hindi'],
    syllabusAnchor: 'CISCE Senior Secondary',
    officialPortalUrl: 'https://cisce.org/',
  },
  {
    id: 'State Board',
    name: 'State Board (General / Regional SCERT)',
    shortName: 'State Board',
    category: 'State',
    stateOrRegion: 'State SCERT Syllabi',
    defaultLanguages: ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Marathi'],
    syllabusAnchor: 'SCERT',
    officialPortalUrl: 'https://diksha.gov.in/',
  },
  {
    id: 'Telangana State Board',
    name: 'Telangana State Board (BSE / TSBIE)',
    shortName: 'Telangana',
    category: 'State',
    stateOrRegion: 'Telangana',
    defaultLanguages: ['Telugu', 'English', 'Urdu', 'Hindi'],
    syllabusAnchor: 'SCERT Telangana / TSBIE',
    officialPortalUrl: 'https://scert.telangana.gov.in/',
  },
  {
    id: 'Andhra Pradesh State Board',
    name: 'Andhra Pradesh State Board (BSEAP / BIEAP)',
    shortName: 'Andhra Pradesh',
    category: 'State',
    stateOrRegion: 'Andhra Pradesh',
    defaultLanguages: ['Telugu', 'English', 'Hindi'],
    syllabusAnchor: 'SCERT Andhra Pradesh',
    officialPortalUrl: 'https://scert.ap.gov.in/',
  },
  {
    id: 'Maharashtra State Board',
    name: 'Maharashtra State Board (MSBSHSE)',
    shortName: 'Maharashtra',
    category: 'State',
    stateOrRegion: 'Maharashtra',
    defaultLanguages: ['Marathi', 'English', 'Hindi', 'Urdu'],
    syllabusAnchor: 'Balbharati / SCERT Maharashtra',
    officialPortalUrl: 'https://www.ebalbharati.in/',
  },
  {
    id: 'Karnataka State Board',
    name: 'Karnataka State Board (KSEAB / PU)',
    shortName: 'Karnataka',
    category: 'State',
    stateOrRegion: 'Karnataka',
    defaultLanguages: ['Kannada', 'English', 'Hindi'],
    syllabusAnchor: 'DSERT Karnataka',
    officialPortalUrl: 'https://ktbs.kar.nic.in/',
  },
  {
    id: 'Tamil Nadu State Board',
    name: 'Tamil Nadu State Board (TNSB / Samacheer Kalvi)',
    shortName: 'Tamil Nadu',
    category: 'State',
    stateOrRegion: 'Tamil Nadu',
    defaultLanguages: ['Tamil', 'English'],
    syllabusAnchor: 'SCERT Tamil Nadu (Samacheer Kalvi)',
    officialPortalUrl: 'https://www.tnschools.gov.in/',
  },
  {
    id: 'Kerala State Board',
    name: 'Kerala State Board (SCERT / DHSE Kerala)',
    shortName: 'Kerala',
    category: 'State',
    stateOrRegion: 'Kerala',
    defaultLanguages: ['Malayalam', 'English'],
    syllabusAnchor: 'SCERT Kerala / KITE Victers',
    officialPortalUrl: 'https://scert.kerala.gov.in/',
  },
  {
    id: 'West Bengal Board',
    name: 'West Bengal Board (WBBSE / WBCHSE)',
    shortName: 'West Bengal',
    category: 'State',
    stateOrRegion: 'West Bengal',
    defaultLanguages: ['Bengali', 'English', 'Hindi'],
    syllabusAnchor: 'WBBSE / WBCHSE',
    officialPortalUrl: 'https://wbbse.wb.gov.in/',
  },
  {
    id: 'Uttar Pradesh Board',
    name: 'Uttar Pradesh Board (UPMSP)',
    shortName: 'UP Board',
    category: 'State',
    stateOrRegion: 'Uttar Pradesh',
    defaultLanguages: ['Hindi', 'English', 'Urdu'],
    syllabusAnchor: 'UPMSP / NCERT Adapted',
    officialPortalUrl: 'https://upmsp.edu.in/',
  },
  {
    id: 'Bihar Board',
    name: 'Bihar School Examination Board (BSEB)',
    shortName: 'Bihar Board',
    category: 'State',
    stateOrRegion: 'Bihar',
    defaultLanguages: ['Hindi', 'English', 'Urdu'],
    syllabusAnchor: 'SCERT Bihar / BSEB',
    officialPortalUrl: 'https://scert.bihar.gov.in/',
  },
  {
    id: 'Rajasthan Board',
    name: 'Rajasthan Board (RBSE)',
    shortName: 'RBSE',
    category: 'State',
    stateOrRegion: 'Rajasthan',
    defaultLanguages: ['Hindi', 'English'],
    syllabusAnchor: 'RBSE / NCERT Adapted',
    officialPortalUrl: 'https://rajeduboard.rajasthan.gov.in/',
  },
  {
    id: 'Gujarat Board',
    name: 'Gujarat Board (GSEB)',
    shortName: 'GSEB',
    category: 'State',
    stateOrRegion: 'Gujarat',
    defaultLanguages: ['Gujarati', 'English', 'Hindi'],
    syllabusAnchor: 'GCERT / GSEB',
    officialPortalUrl: 'https://www.gseb.org/',
  },
  {
    id: 'Madhya Pradesh Board',
    name: 'Madhya Pradesh Board (MPBSE)',
    shortName: 'MP Board',
    category: 'State',
    stateOrRegion: 'Madhya Pradesh',
    defaultLanguages: ['Hindi', 'English'],
    syllabusAnchor: 'MPBSE / SCERT MP',
    officialPortalUrl: 'https://mpbse.nic.in/',
  },
  {
    id: 'Odisha Board',
    name: 'Odisha Board (BSE Odisha / CHSE)',
    shortName: 'Odisha',
    category: 'State',
    stateOrRegion: 'Odisha',
    defaultLanguages: ['Odia', 'English', 'Hindi'],
    syllabusAnchor: 'SCERT Odisha',
    officialPortalUrl: 'https://www.bseodisha.ac.in/',
  },
  {
    id: 'Punjab Board',
    name: 'Punjab School Education Board (PSEB)',
    shortName: 'PSEB',
    category: 'State',
    stateOrRegion: 'Punjab',
    defaultLanguages: ['Punjabi', 'English', 'Hindi'],
    syllabusAnchor: 'PSEB',
    officialPortalUrl: 'https://www.pseb.ac.in/',
  },
  {
    id: 'Haryana Board',
    name: 'Haryana Board (HBSE / BSEH)',
    shortName: 'HBSE',
    category: 'State',
    stateOrRegion: 'Haryana',
    defaultLanguages: ['Hindi', 'English'],
    syllabusAnchor: 'SCERT Haryana',
    officialPortalUrl: 'https://bseh.org.in/',
  },
  {
    id: 'Assam Board',
    name: 'Assam Board (SEBA / AHSEC)',
    shortName: 'Assam',
    category: 'State',
    stateOrRegion: 'Assam',
    defaultLanguages: ['Assamese', 'Bengali', 'Bodo', 'English', 'Hindi'],
    syllabusAnchor: 'SCERT Assam / SEBA',
    officialPortalUrl: 'https://site.sebaonline.org/',
  },
  {
    id: 'Uttarakhand Board',
    name: 'Uttarakhand Board (UBSE)',
    shortName: 'UBSE',
    category: 'State',
    stateOrRegion: 'Uttarakhand',
    defaultLanguages: ['Hindi', 'English'],
    syllabusAnchor: 'SCERT Uttarakhand',
    officialPortalUrl: 'https://ubse.uk.gov.in/',
  },
  {
    id: 'Himachal Pradesh Board',
    name: 'Himachal Pradesh Board (HPBOSE)',
    shortName: 'HPBOSE',
    category: 'State',
    stateOrRegion: 'Himachal Pradesh',
    defaultLanguages: ['Hindi', 'English'],
    syllabusAnchor: 'HPBOSE',
    officialPortalUrl: 'https://www.hpbose.org/',
  },
  {
    id: 'Jharkhand Board',
    name: 'Jharkhand Academic Council (JAC)',
    shortName: 'JAC',
    category: 'State',
    stateOrRegion: 'Jharkhand',
    defaultLanguages: ['Hindi', 'English', 'Santali'],
    syllabusAnchor: 'JCERT / JAC',
    officialPortalUrl: 'https://jac.jharkhand.gov.in/',
  },
  {
    id: 'Chhattisgarh Board',
    name: 'Chhattisgarh Board (CGBSE)',
    shortName: 'CGBSE',
    category: 'State',
    stateOrRegion: 'Chhattisgarh',
    defaultLanguages: ['Hindi', 'English'],
    syllabusAnchor: 'SCERT Chhattisgarh',
    officialPortalUrl: 'https://cgbse.nic.in/',
  },
  {
    id: 'Goa Board',
    name: 'Goa Board (GBSHSE)',
    shortName: 'Goa Board',
    category: 'State',
    stateOrRegion: 'Goa',
    defaultLanguages: ['English', 'Konkani', 'Marathi'],
    syllabusAnchor: 'SCERT Goa',
    officialPortalUrl: 'https://www.gbshse.in/',
  },
  {
    id: 'Jammu & Kashmir Board',
    name: 'Jammu & Kashmir / Ladakh Board (JKBOSE)',
    shortName: 'JKBOSE',
    category: 'State',
    stateOrRegion: 'Jammu & Kashmir & Ladakh',
    defaultLanguages: ['English', 'Urdu', 'Hindi', 'Kashmiri', 'Dogri'],
    syllabusAnchor: 'JKBOSE',
    officialPortalUrl: 'https://jkbose.nic.in/',
  },
  {
    id: 'North-East Boards',
    name: 'North-East State Boards (Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura, Arunachal)',
    shortName: 'North-East Boards',
    category: 'State',
    stateOrRegion: 'North-East India',
    defaultLanguages: ['English', 'Manipuri', 'Mizo', 'Nepali', 'Bengali', 'Hindi'],
    syllabusAnchor: 'State SCERT / NBSE / MBOSE / MBSE / TBSE',
    officialPortalUrl: 'https://diksha.gov.in/',
  },
  {
    id: 'NIOS',
    name: 'NIOS (National Institute of Open Schooling)',
    shortName: 'NIOS',
    category: 'Open',
    stateOrRegion: 'All India (Open & Flexible)',
    defaultLanguages: ['English', 'Hindi', 'Urdu'],
    syllabusAnchor: 'NIOS',
    officialPortalUrl: 'https://www.nios.ac.in/',
  },
];

export const INDIAN_LANGUAGES: LanguageDefinition[] = [
  { name: 'English', nativeLabel: 'English', bcp47: 'en-IN', iso639_1: 'en' },
  { name: 'Hindi', nativeLabel: 'हिन्दी', bcp47: 'hi-IN', iso639_1: 'hi' },
  { name: 'Telugu', nativeLabel: 'తెలుగు', bcp47: 'te-IN', iso639_1: 'te' },
  { name: 'Tamil', nativeLabel: 'தமிழ்', bcp47: 'ta-IN', iso639_1: 'ta' },
  { name: 'Kannada', nativeLabel: 'ಕನ್ನಡ', bcp47: 'kn-IN', iso639_1: 'kn' },
  { name: 'Malayalam', nativeLabel: 'മലയാളം', bcp47: 'ml-IN', iso639_1: 'ml' },
  { name: 'Marathi', nativeLabel: 'मराठी', bcp47: 'mr-IN', iso639_1: 'mr' },
  { name: 'Gujarati', nativeLabel: 'ગુજરાતી', bcp47: 'gu-IN', iso639_1: 'gu' },
  { name: 'Bengali', nativeLabel: 'বাংলা', bcp47: 'bn-IN', iso639_1: 'bn' },
  { name: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', bcp47: 'or-IN', iso639_1: 'or' },
  { name: 'Assamese', nativeLabel: 'অসমীয়া', bcp47: 'as-IN', iso639_1: 'as' },
  { name: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN', iso639_1: 'pa' },
  { name: 'Urdu', nativeLabel: 'اردو', bcp47: 'ur-IN', iso639_1: 'ur' },
  { name: 'Sanskrit', nativeLabel: 'संस्कृतम्', bcp47: 'sa-IN', iso639_1: 'sa' },
  { name: 'Konkani', nativeLabel: 'कोंकणी', bcp47: 'kok-IN', iso639_1: 'kok' },
  { name: 'Kashmiri', nativeLabel: 'कॉशुर / کٲشُر', bcp47: 'ks-IN', iso639_1: 'ks' },
  { name: 'Dogri', nativeLabel: 'डोगरी', bcp47: 'doi-IN', iso639_1: 'doi' },
  { name: 'Bodo', nativeLabel: 'बर’', bcp47: 'brx-IN', iso639_1: 'brx' },
  { name: 'Manipuri', nativeLabel: 'মৈতৈলোন্', bcp47: 'mni-IN', iso639_1: 'mni' },
  { name: 'Mizo', nativeLabel: 'Mizo ṭawng', bcp47: 'lus-IN', iso639_1: 'lus' },
  { name: 'Nepali', nativeLabel: 'नेपाली', bcp47: 'ne-IN', iso639_1: 'ne' },
  { name: 'Santali', nativeLabel: 'ᱥᱟᱱᱛᱟᱲᱤ', bcp47: 'sat-IN', iso639_1: 'sat' },
  { name: 'Sindhi', nativeLabel: 'सिन्धी / سنڌي', bcp47: 'sd-IN', iso639_1: 'sd' },
];

export const OFFICIAL_EDUCATION_PORTALS: OfficialResourceLink[] = [
  {
    id: 'portal_diksha',
    title: 'DIKSHA — Official NCERT & State Board Education Library',
    provider: 'Government of India · NCERT & State SCERTs',
    description: 'Official textbooks, interactive lessons, videos, practice worksheets, and QR resources for Classes 1–12 across CBSE, NCERT, and State Boards in 30+ Indian languages.',
    url: 'https://diksha.gov.in/',
    boards: ['CBSE', 'Telangana State Board', 'Andhra Pradesh State Board', 'Maharashtra State Board', 'Karnataka State Board', 'Tamil Nadu State Board', 'State Board'],
    classRange: 'Classes 1–12',
    languages: ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Marathi', 'Malayalam', 'Gujarati', 'Bengali', 'Odia'],
    badge: 'DIKSHA Portal',
  },
  {
    id: 'portal_pmevidya_200_tv',
    title: 'PM eVIDYA — 200 Official Educational TV Channels',
    provider: 'Ministry of Education / NCERT CIET',
    description: 'State-wise and class-wise channel allocations across 200 DTH educational TV channels covering Classes 1–12 in multiple Indian languages.',
    url: 'https://www.pmevidyaapps.ncert.gov.in/channel-allocations',
    boards: ['CBSE', 'State Board', 'NIOS'],
    classRange: 'Classes 1–12',
    languages: ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Marathi', 'Bengali', 'Regional Languages'],
    badge: '200 TV Channels',
  },
  {
    id: 'portal_ncert_pmevidya',
    title: 'PM eVIDYA YouTube & DTH Channels Directory (NCERT CIET)',
    provider: 'NCERT CIET',
    description: 'Direct links to official PM eVIDYA class-wise YouTube streams and telecast channels for Classes 1–12.',
    url: 'https://ciet.ncert.gov.in/pmevidyadthtvchannelslist?lang=en',
    boards: ['CBSE', 'State Board', 'NIOS'],
    classRange: 'Classes 1–12',
    languages: ['English', 'Hindi', 'Regional Languages'],
    badge: 'PM eVIDYA YT',
  },
  {
    id: 'portal_pmevidya_main',
    title: 'PM eVIDYA National Digital Education Portal',
    provider: 'Department of School Education & Literacy, Govt. of India',
    description: 'Centralized multi-mode access uniting DIKSHA, SWAYAM, DTH TV, radio, and inclusive e-content for Classes 1–12.',
    url: 'https://pmevidya.education.gov.in/?lang=en',
    boards: ['CBSE', 'State Board', 'NIOS'],
    classRange: 'Classes 1–12',
    languages: ['English', 'Hindi'],
    badge: 'PM eVIDYA Portal',
  },
  {
    id: 'portal_workbookguruji',
    title: 'WORKBOOKGURUJI — Curated Chapter Guides & Video Lessons',
    provider: 'YouTube Guide Channel (@WORKBOOKGURUJI)',
    description: 'Step-by-step workbook walkthroughs, chapter guides, and exam solutions for school learners.',
    url: 'http://www.youtube.com/@WORKBOOKGURUJI',
    boards: ['CBSE', 'ICSE', 'State Board'],
    classRange: 'Classes 1–12',
    languages: ['English', 'Hindi'],
    badge: 'Featured Guide Channel',
  },
  {
    id: 'portal_swayam',
    title: 'SWAYAM / NCERT MOOCs (Classes 9–12)',
    provider: 'Ministry of Education, Govt. of India',
    description: 'Structured video lecture series and self-assessment modules for Secondary and Senior Secondary (Classes 9–12).',
    url: 'https://swayam.gov.in/',
    boards: ['CBSE', 'NIOS', 'ISC', 'ICSE'],
    classRange: 'Classes 9–12',
    languages: ['English', 'Hindi'],
    badge: 'Official MOOC Portal',
  },
  {
    id: 'portal_ncert_youtube',
    title: 'NCERT Official YouTube Channel (@ncertofficial)',
    provider: 'NCERT New Delhi',
    description: 'Verified official NCERT video lessons, science demonstrations, and PM e-Vidya live sessions.',
    url: 'https://www.youtube.com/@ncertofficial',
    boards: ['CBSE', 'State Board'],
    classRange: 'Classes 1–12',
    languages: ['English', 'Hindi'],
    badge: 'Official YouTube',
  },
  {
    id: 'portal_scert_ts',
    title: 'SCERT Telangana Digital Textbooks & T-SAT Video Portal',
    provider: 'SCERT Telangana',
    description: 'Official Telangana State Board e-textbooks, syllabus maps, and Telugu/English/Urdu medium video lessons.',
    url: 'https://scert.telangana.gov.in/',
    boards: ['Telangana State Board'],
    classRange: 'Classes 1–12',
    languages: ['Telugu', 'English', 'Urdu', 'Hindi'],
    badge: 'State SCERT',
  },
  {
    id: 'portal_cbse_academic',
    title: 'CBSE Academic Curriculum, Sample Papers & Circulars',
    provider: 'CBSE New Delhi',
    description: 'Official syllabus PDFs, competency-based questions, and Class 10 & 12 sample papers.',
    url: 'https://cbseacademic.nic.in/',
    boards: ['CBSE'],
    classRange: 'Classes 1–12',
    languages: ['English', 'Hindi'],
    badge: 'Official Board Portal',
  },
];

export const DEFAULT_APPROVED_CHANNELS: ApprovedChannelEntry[] = [
  {
    id: 'ch_ncert_official',
    channelTitle: 'NCERT OFFICIAL',
    handle: '@ncertofficial',
    boards: ['CBSE', 'State Board', 'UP Board', 'RBSE'],
    languages: ['English', 'Hindi'],
    subjects: ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'Social Studies', 'English', 'EVS / Environmental Studies'],
    officialGovernment: true,
  },
  {
    id: 'ch_pmevidya',
    channelTitle: 'PM eVIDYA NCERT CIET',
    handle: '@PMeVIDYANCERTOFFICIAL',
    boards: ['CBSE', 'NIOS', 'State Board'],
    languages: ['English', 'Hindi'],
    subjects: ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Economics'],
    officialGovernment: true,
  },
  {
    id: 'ch_tsat',
    channelTitle: 'T-SAT Network (Telangana)',
    handle: '@tsatnetwork',
    boards: ['Telangana State Board'],
    languages: ['Telugu', 'English', 'Urdu'],
    subjects: ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'Social Studies', 'Telugu'],
    officialGovernment: true,
  },
  {
    id: 'ch_kite_victers',
    channelTitle: 'KITE Victers (Kerala)',
    handle: '@kloikitevicters',
    boards: ['Kerala State Board'],
    languages: ['Malayalam', 'English'],
    subjects: ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'Malayalam'],
    officialGovernment: true,
  },
  {
    id: 'ch_magnet_brains',
    channelTitle: 'Magnet Brains',
    handle: '@MagnetBrainsEducation',
    boards: ['CBSE', 'UP Board', 'Bihar Board', 'MP Board'],
    languages: ['Hindi', 'English'],
    subjects: ['Mathematics', 'Science', 'Social Studies', 'Physics', 'Chemistry', 'Biology', 'Accountancy', 'Economics', 'English'],
    officialGovernment: false,
  },
  {
    id: 'ch_workbookguruji',
    channelTitle: 'WORKBOOKGURUJI (@WORKBOOKGURUJI)',
    handle: '@WORKBOOKGURUJI',
    boards: ['CBSE', 'ICSE', 'State Board'],
    languages: ['English', 'Hindi'],
    subjects: ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'English', 'Social Studies', 'Hindi'],
    officialGovernment: false,
  },
  {
    id: 'ch_khan_academy_india',
    channelTitle: 'Khan Academy India',
    handle: '@KhanAcademyIndia',
    boards: ['CBSE', 'ICSE', 'ISC', 'State Board'],
    languages: ['English', 'Hindi', 'Kannada', 'Marathi', 'Gujarati', 'Punjabi'],
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'],
    officialGovernment: false,
  },
];

export interface SubjectDescriptor {
  name: string;
  stream?: 'Core' | 'MPC / PCM' | 'BiPC / PCB' | 'Commerce' | 'Humanities' | 'Languages & Skills';
  description: string;
}

export function getSubjectsForBoardAndClass(board: string, classLevel: number): SubjectDescriptor[] {
  const safeClass = Math.min(12, Math.max(1, Math.round(classLevel || 7)));
  const boardDef = INDIAN_BOARDS.find((b) => b.id === board || b.shortName === board);
  const regionalLang =
    boardDef?.defaultLanguages.find((l) => l !== 'English' && l !== 'Hindi') || null;

  if (safeClass <= 2) {
    const base: SubjectDescriptor[] = [
      { name: 'English', stream: 'Languages & Skills', description: 'Phonics, sight words, picture stories & early sentences' },
      { name: 'Mathematics', stream: 'Core', description: 'Counting, number sense, shapes, patterns & basic addition' },
      { name: 'EVS / World Around Us', stream: 'Core', description: 'Family, plants, animals, seasons, hygiene & community helpers' },
      { name: 'Hindi', stream: 'Languages & Skills', description: 'Swar, Vyanjan, simple words & rhymes' },
      { name: 'General Knowledge & Storytelling', stream: 'Languages & Skills', description: 'Moral stories, colors, days & healthy habits' },
    ];
    if (regionalLang) {
      base.splice(3, 0, {
        name: regionalLang,
        stream: 'Languages & Skills',
        description: `Foundational ${regionalLang} alphabet, reading & rhymes`,
      });
    }
    return base;
  }

  if (safeClass <= 5) {
    const base: SubjectDescriptor[] = [
      { name: 'Mathematics', stream: 'Core', description: 'Multiplication, division, fractions, decimals, geometry & measurement' },
      { name: 'EVS / Environmental Studies', stream: 'Core', description: 'Water cycle, nutrition, habitats, simple machines & maps' },
      { name: 'English', stream: 'Languages & Skills', description: 'Reading comprehension, grammar basics & paragraph writing' },
      { name: 'Hindi', stream: 'Languages & Skills', description: 'Vyakaran, story comprehension & vocabulary building' },
      { name: 'Computer Basics & Coding', stream: 'Core', description: 'Digital safety, logic puzzles & visual coding foundations' },
    ];
    if (regionalLang) {
      base.push({
        name: regionalLang,
        stream: 'Languages & Skills',
        description: `${regionalLang} textbook chapters, grammar & composition`,
      });
    }
    return base;
  }

  if (safeClass <= 8) {
    const base: SubjectDescriptor[] = [
      { name: 'Mathematics', stream: 'Core', description: 'Integers, algebraic expressions, triangles, Pythagoras & mensuration' },
      { name: 'Science', stream: 'Core', description: 'Plant nutrition, force & pressure, light, cells & chemical changes' },
      { name: 'Social Studies', stream: 'Core', description: 'Indian Constitution, medieval/modern history, resources & civics' },
      { name: 'English', stream: 'Languages & Skills', description: 'Active/passive voice, tenses, literature & essay writing' },
      { name: 'Hindi', stream: 'Languages & Skills', description: 'Vasant / Sparsh prose, poetry & formal letter writing' },
      { name: 'Computer Science', stream: 'Core', description: 'Algorithms, HTML/CSS basics, Python intro & cyber hygiene' },
    ];
    if (regionalLang) {
      base.push({
        name: regionalLang,
        stream: 'Languages & Skills',
        description: `${regionalLang} literature, grammar & board lessons`,
      });
    }
    return base;
  }

  if (safeClass <= 10) {
    const isIcse = board.toUpperCase().includes('ICSE');
    const base: SubjectDescriptor[] = [
      { name: 'Mathematics', stream: 'Core', description: 'Quadratics, trigonometry, coordinate geometry, circles & statistics' },
      ...(isIcse
        ? [
            { name: 'Physics', stream: 'Core' as const, description: 'Laws of motion, optics, electricity, calorimetry & sound' },
            { name: 'Chemistry', stream: 'Core' as const, description: 'Atomic structure, periodic table, acids/bases & organic intro' },
            { name: 'Biology', stream: 'Core' as const, description: 'Cell division, photosynthesis, genetics & human physiology' },
          ]
        : [
            { name: 'Science', stream: 'Core' as const, description: 'Chemical reactions, electricity, light reflection, life processes & heredity' },
            { name: 'Physics', stream: 'Core' as const, description: 'Motion, gravitation, electricity, magnetism & optics' },
            { name: 'Chemistry', stream: 'Core' as const, description: 'Matter, carbon compounds, metals/non-metals & periodic classification' },
            { name: 'Biology', stream: 'Core' as const, description: 'Cell structure, control & coordination, reproduction & ecology' },
          ]),
      { name: 'Social Studies', stream: 'Core', description: 'Nationalism, contemporary India geography, democracy & economics' },
      { name: 'English', stream: 'Languages & Skills', description: 'Board literature, analytical paragraphs & editing' },
      { name: 'Computer Applications', stream: 'Core', description: 'Python / Java foundations, databases & networking' },
    ];
    if (regionalLang) {
      base.push({
        name: regionalLang,
        stream: 'Languages & Skills',
        description: `${regionalLang} Secondary Board prose, poetry & grammar`,
      });
    }
    return base;
  }

  // Senior Secondary Classes 11-12
  return [
    { name: 'Physics', stream: 'MPC / PCM', description: 'Mechanics, thermodynamics, electrostatics, optics & modern physics' },
    { name: 'Chemistry', stream: 'MPC / PCM', description: 'Thermodynamics, equilibrium, coordination & organic reaction mechanisms' },
    { name: 'Mathematics', stream: 'MPC / PCM', description: 'Calculus, vectors, matrices, probability & 3D geometry' },
    { name: 'Biology', stream: 'BiPC / PCB', description: 'Biomolecules, plant/human physiology, genetics & biotechnology' },
    { name: 'Computer Science', stream: 'MPC / PCM', description: 'Python data structures, SQL databases & computer networks' },
    { name: 'Accountancy', stream: 'Commerce', description: 'Financial statements, partnership accounts & cash flow analysis' },
    { name: 'Business Studies', stream: 'Commerce', description: 'Management principles, marketing & financial markets' },
    { name: 'Economics', stream: 'Commerce', description: 'Microeconomics, national income, banking & Indian economic development' },
    { name: 'History', stream: 'Humanities', description: 'World civilizations, Indian freedom struggle & constitutional making' },
    { name: 'Political Science', stream: 'Humanities', description: 'Indian Constitution at work, political theory & international relations' },
    { name: 'English Core', stream: 'Languages & Skills', description: 'Flamingo/Hornbill literature, comprehension & formal drafting' },
  ];
}

const CHAPTER_CATALOG: Record<string, string[]> = {
  Mathematics: [
    'Number Systems & Irrational Numbers',
    'Polynomials & Algebraic Identities',
    'Linear Equations in Two Variables',
    'Triangles, Pythagoras & Heron’s Formula',
    'Trigonometry & Heights',
    'Calculus & Differential Equations',
    'Probability & Statistics',
  ],
  Science: [
    'Nutrition in Plants & Photosynthesis',
    'The Earth in the Solar System',
    'Motion, Force & Laws of Motion',
    'The Fundamental Unit of Life (Cells)',
    'Atomic Structure & Molecules',
    'Light, Reflection & Refraction',
    'Acids, Bases and Salts',
    'Electricity and Circuits',
  ],
  Physics: [
    'Motion, Speed, Velocity & Acceleration Graphs',
    'Force & Newton’s Laws of Motion',
    'Gravitation, Free Fall & Buoyancy',
    'Work, Energy & Power',
    'Sound Waves & Reflection',
    'Light Optics & Lenses',
    'Electrostatics & Current Electricity',
  ],
  Chemistry: [
    'Matter in Our Surroundings',
    'Atoms, Molecules & Mole Concept',
    'Atomic Structure & Bohr Shells',
    'Chemical Reactions & Equations',
    'Periodic Table & Chemical Bonding',
    'Carbon Compounds & Organic Mechanisms',
  ],
  Biology: [
    'Cell: The Fundamental Unit of Life',
    'Plant & Animal Tissues',
    'Improvement in Food Resources & Crops',
    'Photosynthesis & Plant Physiology',
    'Human Digestive & Circulatory Systems',
    'Genetics, Heredity & Evolution',
  ],
  'EVS / Environmental Studies': [
    'Water Cycle & Conservation',
    'Plants & Animals Around Us',
    'Food, Nutrition & Clean Habits',
    'Our Neighborhood & Maps',
  ],
  'EVS / World Around Us': [
    'My Family & Body Parts',
    'Plants, Animals & Seasons',
    'Good Habits & Safety',
  ],
  'Social Studies': [
    'Key Features of the Indian Constitution',
    'Our Changing Earth & Resources',
    'Indian Freedom Movement',
    'Democracy & Local Governance',
  ],
  English: [
    'Active and Passive Voice',
    'Tenses & Sentence Structure',
    'Reading Comprehension Strategies',
    'Formal Letters & Essay Writing',
  ],
  'English Core': [
    'Unseen Passage Analysis',
    'Formal Reports & Letters',
    'Prose & Poetry Themes',
  ],
  'Computer Science': [
    'Algorithms & Problem Solving',
    'Python Programming Foundations',
    'SQL & Relational Databases',
    'Web Design & Cyber Safety',
  ],
  'Computer Applications': [
    'Programming Logic & Loops',
    'Functions & Arrays/Lists',
    'Networking & Cyber Security',
  ],
  Accountancy: [
    'Accounting Principles & Journal Entries',
    'Trial Balance & Financial Statements',
    'Partnership Accounts & Cash Flow',
  ],
  'Business Studies': [
    'Nature & Principles of Management',
    'Marketing Mix & Consumer Protection',
    'Financial Markets & Entrepreneurship',
  ],
  Economics: [
    'Demand, Supply & Market Equilibrium',
    'National Income & Banking',
    'Indian Economic Reforms & Budget',
  ],
  History: [
    'Indus Valley & Ancient Civilizations',
    'Modern India & Freedom Struggle',
    'World History & Industrial Revolution',
  ],
  'Political Science': [
    'Indian Constitution & Fundamental Rights',
    'Federalism & Parliamentary System',
    'Global Politics & International Bodies',
  ],
};

export function getChaptersForSelection(board: string, classLevel: number, subject: string): string[] {
  const safeClass = Math.min(12, Math.max(1, Math.round(classLevel || 7)));
  const exact = CHAPTER_CATALOG[subject];
  if (exact) {
    if (safeClass <= 5) return exact.slice(0, 3);
    if (safeClass <= 8) return exact.slice(0, 4);
    return exact;
  }
  return [
    `${subject} Chapter 1: Core Foundations (${board} Class ${safeClass})`,
    `${subject} Chapter 2: Key Concepts & Practice`,
    `${subject} Chapter 3: Revision & Exam Prep`,
  ];
}

export function getBcp47ForLanguage(language: string): string {
  const found = INDIAN_LANGUAGES.find(
    (l) => l.name.toLowerCase() === language.trim().toLowerCase()
  );
  return found?.bcp47 || 'en-IN';
}

export function getIsoCodeForLanguage(language: string): string {
  const found = INDIAN_LANGUAGES.find(
    (l) => l.name.toLowerCase() === language.trim().toLowerCase()
  );
  return found?.iso639_1 || 'en';
}
