export interface ValuePropOption {
  id: string; // '1' | '2'
  label: string;
  name: string;
  text: string;
}

export interface CampaignAsset {
  id: string;
  name: string;
  assetTitle: string;
  valuePropositions: ValuePropOption[];
}

export interface Campaign {
  id: string;
  assetId: string;
  variantId: string;
  name: string;
  assetTitle: string;
  valueProposition: string;
}

export const CAMPAIGN_ASSETS: CampaignAsset[] = [
  {
    id: 'hris',
    name: 'Structured HRIS Solution',
    assetTitle: 'Structured HRIS Solution',
    valuePropositions: [
      {
        id: '1',
        label: 'Value Prop 1',
        name: 'Structured HRIS Solution - 1',
        text: 'We help HR teams identify and implement HRIS solutions that improve employee data management, HR process automation, and workforce management, enabling organizations to operate more efficiently and achieve better HR outcomes.',
      },
      {
        id: '2',
        label: 'Value Prop 2',
        name: 'Structured HRIS Solution - 2',
        text: 'We help HR teams streamline employee data and automate routine HR processes. This improves workforce visibility, efficiency, and overall HR management.',
      },
    ],
  },
  {
    id: 'ats',
    name: 'ATS Solution',
    assetTitle: 'ATS Solution',
    valuePropositions: [
      {
        id: '1',
        label: 'Value Prop 1',
        name: 'ATS Solution - 1',
        text: 'We work with HR teams to figure out which Applicant Tracking Systems really fit their needs, without wasting time on tools that aren’t a good match.',
      },
      {
        id: '2',
        label: 'Value Prop 2',
        name: 'ATS Solution - 2',
        text: 'We help HR teams simplify recruitment and manage candidate workflows efficiently. This reduces manual effort and improves the overall hiring process.',
      },
    ],
  },
  {
    id: 'payroll',
    name: 'Structured Payroll Solution',
    assetTitle: 'Structured Payroll Solution',
    valuePropositions: [
      {
        id: '1',
        label: 'Value Prop 1',
        name: 'Structured Payroll Solution - 1',
        text: 'We helps HR teams identify and implement payroll software that simplifies payroll processing, improves accuracy and compliance, and ensures timely employee payments.',
      },
      {
        id: '2',
        label: 'Value Prop 2',
        name: 'Structured Payroll Solution - 2',
        text: 'We help HR teams identify and implement payroll software that automates payroll processing, improves accuracy and compliance, and ensures timely employee payments, enabling organizations to manage payroll more efficiently.',
      },
    ],
  },
  {
    id: 'lms',
    name: 'Structured LMS Solution',
    assetTitle: 'Structured LMS Solution',
    valuePropositions: [
      {
        id: '1',
        label: 'Value Prop 1',
        name: 'Structured LMS Solution - 1',
        text: 'we help learning and development teams identify and implement Learning Management System (LMS) solutions that streamline training delivery, learner engagement, and performance tracking, enabling organizations to enhance workforce development and achieve better learning outcomes.',
      },
      {
        id: '2',
        label: 'Value Prop 2',
        name: 'Structured LMS Solution - 2',
        text: 'We helps learning and development teams find and implement Learning Management System solutions that make it easier to deliver training, engage learners, and track progress, helping organizations improve employee learning and development.',
      },
    ],
  },
];

export const DEFAULT_CAMPAIGNS: Campaign[] = CAMPAIGN_ASSETS.flatMap(asset =>
  asset.valuePropositions.map(vp => ({
    id: `${asset.id}-${vp.id}`,
    assetId: asset.id,
    variantId: vp.id,
    name: vp.name,
    assetTitle: asset.assetTitle,
    valueProposition: vp.text,
  }))
);
