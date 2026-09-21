export interface Campaign {
  id: string;
  name: string;
  assetTitle: string;
  valueProposition: string;
}

export const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: 'lms-campaign',
    name: 'LMS Campaign',
    assetTitle: 'Learning Management System (LMS)',
    valueProposition: 'Helps learning and development teams streamline training delivery, improve learner engagement, track performance, enhance workforce development, and achieve better learning outcomes.',
  },
  {
    id: 'cybersecurity-campaign',
    name: 'Cybersecurity Assessment Campaign',
    assetTitle: 'Enterprise Security & Threat Prevention Suite',
    valueProposition: 'Enables IT and security leaders to identify vulnerabilities, safeguard sensitive corporate data, ensure regulatory compliance, and defend against emerging cyber threats.',
  },
  {
    id: 'cloud-migration-campaign',
    name: 'Cloud Migration & Modernization',
    assetTitle: 'Cloud Infrastructure Optimization Platform',
    valueProposition: 'Assists cloud architects and IT executive teams in accelerating cloud migration, reducing operational infrastructure overhead, and enhancing cross-region application scalability.',
  },
  {
    id: 'hr-systems-campaign',
    name: 'HR Systems Modernization',
    assetTitle: 'Human Capital Management (HCM) Platform',
    valueProposition: 'Empowers HR executives and people managers to streamline payroll processing, talent acquisition, employee onboarding, and workforce performance analytics.',
  },
];
