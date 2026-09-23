import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { STTConfig, AIConfig, CRMConfig, ClientRecord, CampaignRecord, QACheckpoints, StoredLead } from './types';
import { DEFAULT_AI_PROMPT_TEMPLATE } from './defaultPrompt';

export interface GlobalSettingsSchema {
  sttConfig: STTConfig;
  aiConfig: AIConfig;
  crmConfig: CRMConfig;
  activeClientCode: string;
  activeCampaignCode: string;
  campaigns?: CampaignRecord[];
}

export type StoredSettings = GlobalSettingsSchema;
export type { StoredLead };


const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'demandflowarm'
};

export async function getMysqlConnection() {
  try {
    const connection = await mysql.createConnection(MYSQL_CONFIG);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_CONFIG.database}\`;`);
    await connection.query(`USE \`${MYSQL_CONFIG.database}\`;`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS global_settings (
        id INT PRIMARY KEY DEFAULT 1,
        stt_provider VARCHAR(50) DEFAULT 'GoogleCloud',
        stt_api_key TEXT,
        stt_endpoint TEXT,
        gcs_bucket VARCHAR(255),
        ai_provider VARCHAR(50) DEFAULT 'Google AI Studio',
        ai_api_key TEXT,
        ai_model VARCHAR(100) DEFAULT 'gemini-3.6-flash',
        ai_temperature FLOAT DEFAULT 0.2,
        ai_max_tokens INT DEFAULT 2048,
        crm_api_url TEXT,
        crm_api_key TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        main_prompt LONGTEXT,
        client_rules LONGTEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        client_code VARCHAR(50) NOT NULL,
        campaign_code VARCHAR(100) NOT NULL UNIQUE,
        campaign_name VARCHAR(255) NOT NULL,
        asset_title VARCHAR(255),
        campaign_rules LONGTEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_value_propositions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        value_proposition TEXT NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_reference_number VARCHAR(100) NOT NULL UNIQUE,
        lead_id VARCHAR(100) NOT NULL,
        client_code VARCHAR(50) NOT NULL,
        campaign_code VARCHAR(100) NOT NULL,
        agent_name VARCHAR(150),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) DEFAULT '',
        full_name VARCHAR(200) DEFAULT '',
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        contact_phone VARCHAR(50) DEFAULT '',
        job_title VARCHAR(150) DEFAULT '',
        company_name VARCHAR(255) DEFAULT '',
        company_size VARCHAR(50) DEFAULT '',
        industry VARCHAR(100) DEFAULT '',
        country VARCHAR(100) DEFAULT 'United States',
        qa_status VARCHAR(50) DEFAULT 'Pending QA',
        client_delivery_status VARCHAR(50) DEFAULT 'Pending',
        processing_status ENUM('Pending', 'Processing', 'Raw Transcript Generated', 'Editing', 'Completed', 'Failed') DEFAULT 'Pending',
        error_message TEXT,
        recording_url TEXT,
        raw_transcript LONGTEXT,
        generated_transcript LONGTEXT,
        stt_duration_ms INT DEFAULT 0,
        ai_duration_ms INT DEFAULT 0,
        qualification_data JSON,
        checkpoints_data JSON,
        processed_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    return connection;
  } catch (err) {
    return null;
  }
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsSchema = {
  sttConfig: {
    provider: 'GoogleCloud',
    apiKey: '',
    endpoint: 'https://speech.googleapis.com/v1/speech:recognize'
  },
  aiConfig: {
    provider: 'Google AI Studio',
    apiKey: '',
    model: 'gemini-3.6-flash',
    temperature: 0.2,
    maxTokens: 2048
  },
  crmConfig: {
    crmApiUrl: 'http://app.tarajglobal.com/demandflowbridge/api/get_leads.php',
    crmApiKey: ''
  },
  activeClientCode: '',
  activeCampaignCode: ''
};

function ensureDbFileExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      globalSettings: DEFAULT_GLOBAL_SETTINGS,
      clients: [],
      campaigns: [],
      leads: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// ==============================================================================
// 1. GLOBAL CREDENTIALS SETTINGS
// ==============================================================================
export async function getGlobalSettings(): Promise<GlobalSettingsSchema> {
  try {
    const conn = await getMysqlConnection();
    if (conn) {
      const [rows]: any = await conn.query(`SELECT * FROM global_settings WHERE id = 1 LIMIT 1`);
      await conn.end();
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        return {
          sttConfig: {
            provider: r.stt_provider || 'GoogleCloud',
            apiKey: r.stt_api_key || '',
            endpoint: r.stt_endpoint || 'https://speech.googleapis.com/v1/speech:recognize',
            gcsBucket: r.gcs_bucket || ''
          },
          aiConfig: {
            provider: r.ai_provider || 'Google AI Studio',
            apiKey: r.ai_api_key || '',
            model: r.ai_model || 'gemini-3.6-flash',
            temperature: r.ai_temperature || 0.2,
            maxTokens: r.ai_max_tokens || 2048
          },
          crmConfig: {
            crmApiUrl: r.crm_api_url || 'http://app.tarajglobal.com/demandflowbridge/api/get_leads.php',
            crmApiKey: r.crm_api_key || ''
          },
          activeClientCode: '',
          activeCampaignCode: ''
        };
      }
    }
  } catch (err) {}

  ensureDbFileExists();
  try {
    const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(dataStr);
    return { ...DEFAULT_GLOBAL_SETTINGS, ...(parsed.globalSettings || {}) };
  } catch (err) {
    return DEFAULT_GLOBAL_SETTINGS;
  }
}

export async function saveGlobalSettings(settings: Partial<GlobalSettingsSchema>): Promise<GlobalSettingsSchema> {
  const current = await getGlobalSettings();
  const updated: GlobalSettingsSchema = {
    ...current,
    ...settings,
    sttConfig: { ...current.sttConfig, ...(settings.sttConfig || {}) },
    aiConfig: { ...current.aiConfig, ...(settings.aiConfig || {}) },
    crmConfig: { ...current.crmConfig, ...(settings.crmConfig || {}) }
  };

  try {
    const conn = await getMysqlConnection();
    if (conn) {
      await conn.query(`
        INSERT INTO global_settings (id, stt_provider, stt_api_key, stt_endpoint, gcs_bucket, ai_provider, ai_api_key, ai_model, ai_temperature, ai_max_tokens, crm_api_url, crm_api_key)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          stt_provider = VALUES(stt_provider),
          stt_api_key = VALUES(stt_api_key),
          stt_endpoint = VALUES(stt_endpoint),
          gcs_bucket = VALUES(gcs_bucket),
          ai_provider = VALUES(ai_provider),
          ai_api_key = VALUES(ai_api_key),
          ai_model = VALUES(ai_model),
          ai_temperature = VALUES(ai_temperature),
          ai_max_tokens = VALUES(ai_max_tokens),
          crm_api_url = VALUES(crm_api_url),
          crm_api_key = VALUES(crm_api_key);
      `, [
        updated.sttConfig.provider,
        updated.sttConfig.apiKey,
        updated.sttConfig.endpoint,
        updated.sttConfig.gcsBucket || '',
        updated.aiConfig.provider,
        updated.aiConfig.apiKey,
        updated.aiConfig.model,
        updated.aiConfig.temperature,
        updated.aiConfig.maxTokens,
        updated.crmConfig.crmApiUrl,
        updated.crmConfig.crmApiKey || ''
      ]);
      await conn.end();
    }
  } catch (err) {}

  ensureDbFileExists();
  try {
    const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(dataStr);
    parsed.globalSettings = updated;
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
  } catch (err) {}

  return updated;
}


// ==============================================================================
// 2. CLIENT CODE MANAGEMENT
// ==============================================================================
export async function getClientsFromDatabaseOrApi(): Promise<ClientRecord[]> {
  const clientMap = new Map<string, ClientRecord>();

  try {
    const conn = await getMysqlConnection();
    if (conn) {
      const [clientRows]: any = await conn.query(`SELECT * FROM clients ORDER BY client_code ASC`);
      const [campaignRows]: any = await conn.query(`SELECT * FROM campaigns`);
      const [vpRows]: any = await conn.query(`SELECT * FROM campaign_value_propositions ORDER BY sort_order ASC`);

      await conn.end();

      if (Array.isArray(clientRows) && clientRows.length > 0) {
        clientRows.forEach((r: any) => {
          const clientCampaigns: CampaignRecord[] = (campaignRows || [])
            .filter((c: any) => c.client_id === r.id || c.client_code === r.client_code)
            .map((c: any) => {
              const vps = (vpRows || [])
                .filter((v: any) => v.campaign_id === c.id)
                .map((v: any) => v.value_proposition);
              return {
                id: c.id,
                clientId: c.client_id,
                clientCode: c.client_code,
                campaignCode: c.campaign_code,
                campaignName: c.campaign_name,
                assetTitle: c.asset_title || '',
                campaignRules: c.campaign_rules || '',
                valuePropositions: vps.length > 0 ? vps : ['Default Value Proposition'],
                status: c.status || 'active',
                createdAt: c.created_at,
                updatedAt: c.updated_at
              };
            });

          clientMap.set(r.client_code, {
            id: r.id,
            clientCode: r.client_code,
            name: r.name,
            mainPrompt: r.main_prompt || DEFAULT_AI_PROMPT_TEMPLATE,
            clientRules: r.client_rules || '',
            status: r.status || 'active',
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            campaigns: clientCampaigns
          });
        });

        return Array.from(clientMap.values());
      }
    }
  } catch (err) {}

  ensureDbFileExists();
  try {
    const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(dataStr);
    return Array.isArray(parsed.clients) ? parsed.clients : [];
  } catch (err) {
    return [];
  }
}


export async function saveClient(client: Partial<ClientRecord> & { clientCode: string; name: string }): Promise<ClientRecord> {
  const mainPrompt = client.mainPrompt || DEFAULT_AI_PROMPT_TEMPLATE;
  const clientRules = client.clientRules || '';
  const status = client.status || 'active';

  try {
    const conn = await getMysqlConnection();
    if (conn) {
      await conn.query(`
        INSERT INTO clients (client_code, name, main_prompt, client_rules, status)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          main_prompt = VALUES(main_prompt),
          client_rules = VALUES(client_rules),
          status = VALUES(status);
      `, [client.clientCode, client.name, mainPrompt, clientRules, status]);
      await conn.end();
    }
  } catch (err) {}

  ensureDbFileExists();
  const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(dataStr);
  const clientsList: ClientRecord[] = parsed.clients || [];

  const existingIdx = clientsList.findIndex(c => c.clientCode.toLowerCase() === client.clientCode.toLowerCase());
  const updatedRecord: ClientRecord = {
    id: client.id || (existingIdx >= 0 ? clientsList[existingIdx].id : `client-${Date.now()}`),
    clientCode: client.clientCode,
    name: client.name,
    mainPrompt,
    clientRules,
    status,
    createdAt: existingIdx >= 0 ? clientsList[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    campaigns: existingIdx >= 0 ? clientsList[existingIdx].campaigns || [] : []
  };

  if (existingIdx >= 0) {
    clientsList[existingIdx] = updatedRecord;
  } else {
    clientsList.push(updatedRecord);
  }

  parsed.clients = clientsList;
  fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

  return updatedRecord;
}

export async function deleteClient(clientCode: string): Promise<boolean> {
  try {
    const conn = await getMysqlConnection();
    if (conn) {
      await conn.query(`DELETE FROM clients WHERE client_code = ?`, [clientCode]);
      await conn.end();
    }
  } catch (err) {}

  ensureDbFileExists();
  try {
    const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(dataStr);
    parsed.clients = (parsed.clients || []).filter((c: ClientRecord) => c.clientCode !== clientCode);
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}


// ==============================================================================
// 3. CAMPAIGN MANAGEMENT & MULTIPLE VALUE PROPOSITIONS
// ==============================================================================
export async function getCampaignsByClient(clientCode: string): Promise<CampaignRecord[]> {
  const clients = await getClientsFromDatabaseOrApi();
  const matched = clients.find(c => c.clientCode.toLowerCase() === clientCode.toLowerCase());
  return matched?.campaigns || [];
}

export async function saveCampaign(campaign: Partial<CampaignRecord> & { clientCode: string; campaignCode: string; campaignName: string }): Promise<CampaignRecord> {
  const clients = await getClientsFromDatabaseOrApi();
  let client = clients.find(c => c.clientCode.toLowerCase() === campaign.clientCode.toLowerCase());

  if (!client) {
    client = await saveClient({
      clientCode: campaign.clientCode,
      name: `Client ${campaign.clientCode}`
    });
  }

  const assetTitle = campaign.assetTitle || 'Structured B2B Solution';
  const campaignRules = campaign.campaignRules || '';
  const status = campaign.status || 'active';
  const vps = Array.isArray(campaign.valuePropositions) && campaign.valuePropositions.length > 0
    ? campaign.valuePropositions
    : ['Helping organizations identify and implement solutions to optimize performance.'];

  let insertedId: number | string = campaign.id || Date.now();

  try {
    const conn = await getMysqlConnection();
    if (conn) {
      const [res]: any = await conn.query(`
        INSERT INTO campaigns (client_id, client_code, campaign_code, campaign_name, asset_title, campaign_rules, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          campaign_name = VALUES(campaign_name),
          asset_title = VALUES(asset_title),
          campaign_rules = VALUES(campaign_rules),
          status = VALUES(status);
      `, [client.id || 1, campaign.clientCode, campaign.campaignCode, campaign.campaignName, assetTitle, campaignRules, status]);

      if (res.insertId) insertedId = res.insertId;

      // Delete existing VPs and insert updated list
      await conn.query(`DELETE FROM campaign_value_propositions WHERE campaign_id = ?`, [insertedId]);
      for (let idx = 0; idx < vps.length; idx++) {
        await conn.query(`
          INSERT INTO campaign_value_propositions (campaign_id, value_proposition, sort_order)
          VALUES (?, ?, ?)
        `, [insertedId, vps[idx], idx + 1]);
      }
      await conn.end();
    }
  } catch (err) {}

  // Sync to local DB
  ensureDbFileExists();
  const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(dataStr);
  const clientsList: ClientRecord[] = parsed.clients || [];

  const cIdx = clientsList.findIndex(c => c.clientCode.toLowerCase() === campaign.clientCode.toLowerCase());
  const campaignRecord: CampaignRecord = {
    id: insertedId,
    clientId: client.id,
    clientCode: campaign.clientCode,
    campaignCode: campaign.campaignCode,
    campaignName: campaign.campaignName,
    assetTitle,
    campaignRules,
    valuePropositions: vps,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (cIdx >= 0) {
    const campaigns = clientsList[cIdx].campaigns || [];
    const existingCampIdx = campaigns.findIndex(cmp => cmp.campaignCode.toLowerCase() === campaign.campaignCode.toLowerCase());
    if (existingCampIdx >= 0) {
      campaigns[existingCampIdx] = campaignRecord;
    } else {
      campaigns.push(campaignRecord);
    }
    clientsList[cIdx].campaigns = campaigns;
  }

  parsed.clients = clientsList;
  fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

  return campaignRecord;
}

export async function deleteCampaign(campaignCode: string): Promise<boolean> {
  try {
    const conn = await getMysqlConnection();
    if (conn) {
      await conn.query(`DELETE FROM campaigns WHERE campaign_code = ?`, [campaignCode]);
      await conn.end();
    }
  } catch (err) {}

  ensureDbFileExists();
  try {
    const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(dataStr);
    (parsed.clients || []).forEach((c: ClientRecord) => {
      c.campaigns = (c.campaigns || []).filter(cmp => cmp.campaignCode !== campaignCode);
    });
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}


// ==============================================================================
// 4. LEADS PERSISTENCE, PREVENT DUPLICATE PROCESSING, AND API FETCHING
// ==============================================================================
export async function getProcessedLeadByRef(leadRef: string): Promise<StoredLead | null> {
  try {
    const conn = await getMysqlConnection();
    if (conn) {
      const [rows]: any = await conn.query(`SELECT * FROM leads WHERE lead_reference_number = ? OR lead_id = ? OR id = ? LIMIT 1`, [leadRef, leadRef, leadRef]);
      await conn.end();
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        return {
          id: String(r.id || r.lead_reference_number),
          srNo: 1,
          createdAt: r.created_at ? new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '',
          clientCode: String(r.client_code || ''),
          campaignCode: String(r.campaign_code || ''),
          campaignName: String(r.campaign_code || ''),
          agentName: String(r.agent_name || ''),
          firstName: String(r.first_name || ''),
          lastName: String(r.last_name || ''),
          email: String(r.email || ''),
          contactNumber: String(r.phone || r.contact_phone || ''),
          companyName: String(r.company_name || ''),
          country: String(r.country || 'United States'),
          jobTitle: String(r.job_title || ''),
          formStatus: 'Yes',
          qaStatus: String(r.qa_status || 'Pending QA'),
          clientDeliveryStatus: String(r.client_delivery_status || 'Pending'),
          recordingUrl: r.recording_url || '',
          rawTranscript: r.raw_transcript || '',
          modifiedTranscript: r.generated_transcript || r.raw_transcript || '',
          sttDurationMs: r.stt_duration_ms || 1850,
          aiDurationMs: r.ai_duration_ms || 1120,
          qualification: typeof r.qualification_data === 'string' ? JSON.parse(r.qualification_data) : r.qualification_data || undefined,
          checkpoints: typeof r.checkpoints_data === 'string' ? JSON.parse(r.checkpoints_data) : r.checkpoints_data || undefined
        };
      }
    }
  } catch (err) {}

  ensureDbFileExists();
  try {
    const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(dataStr);
    const found = (parsed.leads || []).find((l: StoredLead) => l.id === leadRef || l.email === leadRef);
    return found || null;
  } catch (err) {
    return null;
  }
}

export async function saveProcessedLead(leadData: Partial<StoredLead> & { firstName: string; email: string; clientCode: string; campaignCode: string }): Promise<StoredLead> {
  const leadRef = leadData.id || `LEAD-${Date.now()}`;

  try {
    const conn = await getMysqlConnection();
    if (conn) {
      await conn.query(`
        INSERT INTO leads (lead_reference_number, lead_id, client_code, campaign_code, agent_name, first_name, last_name, full_name, email, phone, contact_phone, job_title, company_name, country, qa_status, client_delivery_status, processing_status, recording_url, raw_transcript, generated_transcript, stt_duration_ms, ai_duration_ms, qualification_data, checkpoints_data, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          raw_transcript = VALUES(raw_transcript),
          generated_transcript = VALUES(generated_transcript),
          processing_status = 'Completed',
          qa_status = VALUES(qa_status),
          qualification_data = VALUES(qualification_data),
          checkpoints_data = VALUES(checkpoints_data),
          processed_at = NOW();
      `, [
        leadRef,
        leadRef,
        leadData.clientCode,
        leadData.campaignCode,
        leadData.agentName || 'Agent',
        leadData.firstName,
        leadData.lastName || '',
        `${leadData.firstName} ${leadData.lastName || ''}`.trim(),
        leadData.email,
        leadData.contactNumber || '',
        leadData.contactNumber || '',
        leadData.jobTitle || '',
        leadData.companyName || '',
        leadData.country || 'United States',
        leadData.qaStatus || 'Qualified',
        leadData.clientDeliveryStatus || 'Delivered',
        leadData.recordingUrl || '',
        leadData.rawTranscript || '',
        leadData.modifiedTranscript || '',
        leadData.sttDurationMs || 1850,
        leadData.aiDurationMs || 1120,
        JSON.stringify(leadData.qualification || {}),
        JSON.stringify(leadData.checkpoints || {})
      ]);
      await conn.end();
    }
  } catch (err) {}

  // Local JSON Backup
  ensureDbFileExists();
  const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(dataStr);
  const leadsList: StoredLead[] = parsed.leads || [];

  const existingIdx = leadsList.findIndex(l => l.id === leadRef || l.email === leadData.email);
  const newLead: StoredLead = {
    id: leadRef,
    srNo: existingIdx >= 0 ? leadsList[existingIdx].srNo : leadsList.length + 1,
    createdAt: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
    clientCode: leadData.clientCode,
    campaignCode: leadData.campaignCode,
    campaignName: leadData.campaignName || leadData.campaignCode,
    agentName: leadData.agentName || 'Assigned Agent',
    firstName: leadData.firstName,
    lastName: leadData.lastName || '',
    email: leadData.email,
    contactNumber: leadData.contactNumber || '',
    companyName: leadData.companyName || 'Company',
    country: leadData.country || 'United States',
    jobTitle: leadData.jobTitle || 'Decision Maker',
    formStatus: 'Yes',
    qaStatus: leadData.qaStatus || 'Qualified',
    clientDeliveryStatus: leadData.clientDeliveryStatus || 'Delivered',
    recordingUrl: leadData.recordingUrl,
    rawTranscript: leadData.rawTranscript || '',
    modifiedTranscript: leadData.modifiedTranscript || '',
    sttDurationMs: leadData.sttDurationMs || 1850,
    aiDurationMs: leadData.aiDurationMs || 1120,
    qualification: leadData.qualification,
    checkpoints: leadData.checkpoints,
    processedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    leadsList[existingIdx] = newLead;
  } else {
    leadsList.unshift(newLead);
  }

  parsed.leads = leadsList;
  fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

  return newLead;
}

export async function getLeadsFromDatabaseOrApi(filters?: { campaignCode?: string; clientCode?: string; search?: string; qaStatus?: string }): Promise<StoredLead[]> {
  const configuredClients = await getClientsFromDatabaseOrApi();
  const configuredClientCodes = new Set(configuredClients.map(c => c.clientCode.toLowerCase()));

  // 1. Query MySQL "demandflowarm" database
  try {
    const conn = await getMysqlConnection();
    if (conn) {
      let sql = `SELECT * FROM leads WHERE 1=1`;
      const params: any[] = [];

      if (filters?.clientCode && filters.clientCode !== 'All Client Codes' && filters.clientCode !== 'all') {
        sql += ` AND LOWER(client_code) = LOWER(?)`;
        params.push(filters.clientCode);
      }
      if (filters?.campaignCode && filters.campaignCode !== 'All Campaigns' && filters.campaignCode !== 'all') {
        sql += ` AND (LOWER(campaign_code) LIKE LOWER(?) OR LOWER(campaign_name) LIKE LOWER(?))`;
        params.push(`%${filters.campaignCode}%`, `%${filters.campaignCode}%`);
      }
      if (filters?.qaStatus && filters.qaStatus !== 'All Status' && filters.qaStatus !== 'all') {
        sql += ` AND LOWER(qa_status) = LOWER(?)`;
        params.push(filters.qaStatus);
      }
      if (filters?.search && filters.search.trim()) {
        const q = `%${filters.search.trim()}%`;
        sql += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company_name LIKE ? OR agent_name LIKE ?)`;
        params.push(q, q, q, q, q);
      }

      sql += ` ORDER BY id DESC`;

      const [rows]: any = await conn.query(sql, params);
      await conn.end();

      if (Array.isArray(rows) && rows.length > 0) {
        return rows
          .filter((r: any) => configuredClientCodes.size === 0 || configuredClientCodes.has((r.client_code || '').toLowerCase()))
          .map((r: any, idx: number) => ({
            id: String(r.id || r.lead_reference_number || r.lead_id),
            srNo: idx + 1,
            createdAt: r.created_at ? new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '',
            clientCode: String(r.client_code || ''),
            campaignCode: String(r.campaign_code || ''),
            campaignName: String(r.campaign_name || r.campaign_code || ''),
            agentName: String(r.agent_name || ''),
            firstName: String(r.first_name || ''),
            lastName: String(r.last_name || ''),
            email: String(r.email || ''),
            contactNumber: String(r.phone || r.contact_phone || ''),
            companyName: String(r.company_name || ''),
            country: String(r.country || 'United States'),
            jobTitle: String(r.job_title || ''),
            formStatus: String(r.form_done || r.form_status || 'Pending'),
            qaStatus: String(r.qa_status || 'Pending QA'),
            clientDeliveryStatus: String(r.client_delivery_status || 'Pending'),
            recordingUrl: r.recording_url || r.recording_path || '',
            rawTranscript: r.raw_transcript || '',
            modifiedTranscript: r.generated_transcript || r.modified_transcript || r.raw_transcript || '',
            sttDurationMs: r.stt_duration_ms || 1850,
            aiDurationMs: r.ai_duration_ms || 1120,
            qualification: typeof r.qualification_data === 'string' ? JSON.parse(r.qualification_data) : r.qualification_data || undefined,
            checkpoints: typeof r.checkpoints_data === 'string' ? JSON.parse(r.checkpoints_data) : r.checkpoints_data || undefined
          }));
      }
    }
  } catch (err) {}

  // 2. Query External CRM API
  try {
    const globalCreds = await getGlobalSettings();
    const apiUrl = globalCreds.crmConfig?.crmApiUrl || 'http://app.tarajglobal.com/demandflowbridge/api/get_leads.php';
    const queryParams = new URLSearchParams();
    if (filters?.clientCode && filters.clientCode !== 'All Client Codes') queryParams.set('client_code', filters.clientCode);
    if (filters?.search) queryParams.set('search', filters.search);
    if (filters?.qaStatus && filters.qaStatus !== 'All Status') queryParams.set('qa_status', filters.qaStatus);
    queryParams.set('limit', 'all');

    const apiRes = await fetch(`${apiUrl}?${queryParams.toString()}`, { cache: 'no-store' });
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData.status === 'success' && Array.isArray(apiData.leads) && apiData.leads.length > 0) {
        const responseClientCode = String(apiData.client?.client_code || filters?.clientCode || '').toLowerCase();
        
        return apiData.leads
          .filter((r: any) => {
            const itemClientCode = String(r.client_code || responseClientCode || '').toLowerCase();
            return configuredClientCodes.size === 0 || configuredClientCodes.has(itemClientCode) || itemClientCode === responseClientCode;
          })
          .map((r: any, idx: number) => ({
            id: String(r.id || r.lead_reference_number || r.lead_id),
            srNo: idx + 1,
            createdAt: r.created_at || r.form_filled_time || '',
            clientCode: String(r.client_code || apiData.client?.client_code || filters?.clientCode || '1020'),
            campaignCode: String(r.campaign_name || r.campaign_id || 'Campaign'),
            campaignName: String(r.campaign_name || ''),
            agentName: String(r.agent_name || ''),
            firstName: String(r.first_name || ''),
            lastName: String(r.last_name || ''),
            email: String(r.email || ''),
            contactNumber: String(r.phone || r.contact_phone || ''),
            companyName: String(r.company_name || ''),
            country: String(r.country || 'United States'),
            jobTitle: String(r.job_title || ''),
            formStatus: String(r.form_done || r.form_status || 'Pending'),
            qaStatus: String(r.qa_status || 'Pending QA'),
            clientDeliveryStatus: String(r.client_delivery_status || 'Pending'),
            recordingUrl: r.recording_url || r.recording_path || '',
            rawTranscript: r.raw_transcript || '',
            modifiedTranscript: r.generated_transcript || r.modified_transcript || r.raw_transcript || ''
          }));
      }
    }
  } catch (err) {}

  // Local JSON fallback
  ensureDbFileExists();
  try {
    const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(dataStr);
    const leads: StoredLead[] = parsed.leads || [];
    return leads.filter(l => configuredClientCodes.size === 0 || configuredClientCodes.has(l.clientCode.toLowerCase()));
  } catch (err) {
    return [];
  }
}
