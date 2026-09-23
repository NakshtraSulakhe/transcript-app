-- ==============================================================================
-- DemandFlow Arm / DemandFlow Bridge Database Schema Initialization
-- Database Name: demandflowarm
-- Target Server: MySQL 5.7+ / MySQL 8.0+ / MariaDB
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `demandflowarm` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `demandflowarm`;

-- ------------------------------------------------------------------------------
-- Table 1: global_settings
-- Stores global API credentials and service configurations once for all clients.
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `campaign_value_propositions`;
DROP TABLE IF EXISTS `lead_recordings`;
DROP TABLE IF EXISTS `leads`;
DROP TABLE IF EXISTS `campaigns`;
DROP TABLE IF EXISTS `clients`;
DROP TABLE IF EXISTS `global_settings`;
DROP TABLE IF EXISTS `client_settings`;

CREATE TABLE `global_settings` (
  `id` INT PRIMARY KEY DEFAULT 1,
  `stt_provider` VARCHAR(50) DEFAULT 'GoogleCloud',
  `stt_api_key` TEXT DEFAULT NULL,
  `stt_endpoint` TEXT DEFAULT NULL,
  `gcs_bucket` VARCHAR(255) DEFAULT NULL,
  `ai_provider` VARCHAR(50) DEFAULT 'Google AI Studio',
  `ai_api_key` TEXT DEFAULT NULL,
  `ai_model` VARCHAR(100) DEFAULT 'gemini-3.6-flash',
  `ai_temperature` FLOAT DEFAULT 0.2,
  `ai_max_tokens` INT DEFAULT 2048,
  `crm_api_url` TEXT DEFAULT NULL,
  `crm_api_key` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 2: clients
-- Stores Client Code management, Client Name, Client Main Prompt, Client Rules.
-- ------------------------------------------------------------------------------
CREATE TABLE `clients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `main_prompt` LONGTEXT DEFAULT NULL,
  `client_rules` LONGTEXT DEFAULT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 3: campaigns
-- Stores Campaign records created under a specific Client Code.
-- ------------------------------------------------------------------------------
CREATE TABLE `campaigns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `client_code` VARCHAR(50) NOT NULL,
  `campaign_code` VARCHAR(100) NOT NULL UNIQUE,
  `campaign_name` VARCHAR(255) NOT NULL,
  `asset_title` VARCHAR(255) DEFAULT NULL,
  `campaign_rules` LONGTEXT DEFAULT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 4: campaign_value_propositions
-- Stores multiple Value Propositions for a Campaign (+ Add Value Proposition).
-- ------------------------------------------------------------------------------
CREATE TABLE `campaign_value_propositions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `campaign_id` INT NOT NULL,
  `value_proposition` TEXT NOT NULL,
  `sort_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 5: leads
-- Main Lead record table storing CRM leads, processing status, raw & edited transcripts.
-- ------------------------------------------------------------------------------
CREATE TABLE `leads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_reference_number` VARCHAR(100) NOT NULL UNIQUE,
  `lead_id` VARCHAR(100) NOT NULL,
  `client_code` VARCHAR(50) NOT NULL,
  `campaign_code` VARCHAR(100) NOT NULL,
  `agent_name` VARCHAR(150) DEFAULT NULL,
  
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) DEFAULT '',
  `full_name` VARCHAR(200) DEFAULT '',
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) DEFAULT '',
  `contact_phone` VARCHAR(50) DEFAULT '',
  
  `job_title` VARCHAR(150) DEFAULT '',
  `company_name` VARCHAR(255) DEFAULT '',
  `company_size` VARCHAR(50) DEFAULT '',
  `industry` VARCHAR(100) DEFAULT '',
  `country` VARCHAR(100) DEFAULT 'United States',
  
  `qa_status` VARCHAR(50) DEFAULT 'Pending QA',
  `client_delivery_status` VARCHAR(50) DEFAULT 'Pending',
  `processing_status` ENUM('Pending', 'Processing', 'Raw Transcript Generated', 'Editing', 'Completed', 'Failed') DEFAULT 'Pending',
  `error_message` TEXT DEFAULT NULL,
  
  `recording_url` TEXT DEFAULT NULL,
  `raw_transcript` LONGTEXT DEFAULT NULL,
  `generated_transcript` LONGTEXT DEFAULT NULL,
  `stt_duration_ms` INT DEFAULT 0,
  `ai_duration_ms` INT DEFAULT 0,
  `qualification_data` JSON DEFAULT NULL,
  `checkpoints_data` JSON DEFAULT NULL,
  
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- 1. Initial Global API Credentials Row
INSERT INTO `global_settings` (`id`, `stt_provider`, `stt_endpoint`, `ai_provider`, `ai_model`, `ai_temperature`, `ai_max_tokens`, `crm_api_url`) VALUES
(1, 'GoogleCloud', 'https://speech.googleapis.com/v1/speech:recognize', 'Google AI Studio', 'gemini-3.6-flash', 0.2, 2048, 'http://localhost/demandflowbridge/api/get_lead.php')
ON DUPLICATE KEY UPDATE `id` = 1;

-- 2. Initial Sample Client Configuration
INSERT INTO `clients` (`id`, `client_code`, `name`, `main_prompt`, `client_rules`, `status`) VALUES
(1, 'CLIENT001', 'Acme Global Enterprises', 'Convert the raw speech-to-text transcript into a clean, accurate, professional B2B call transcript. Remove filler words, disfluencies, and speech-to-text noise while preserving 100% of prospect facts, qualification details, and timeline answers.', '1. Do NOT invent missing details.\n2. Maintain professional conversational paragraph flow.\n3. Preserve verified prospect contact details.', 'active'),
(2, '1010', 'TGS Tech Info', 'Standard TGS Tech Info call transcript editing prompt. Clean up raw audio disfluencies while maintaining original call flow.', '1. Remove IVR and automated phone messages.\n2. Keep prospect qualification answers intact.', 'active');

-- 3. Initial Sample Campaigns under Clients
INSERT INTO `campaigns` (`id`, `client_id`, `client_code`, `campaign_code`, `campaign_name`, `asset_title`, `campaign_rules`, `status`) VALUES
(1, 1, 'CLIENT001', 'CMP001', 'Multi-Cloud Infrastructure Q3', 'Enterprise Multi-Cloud Infrastructure', 'Emphasize zero downtime and multi-cloud migration value.', 'active'),
(2, 2, '1010', 'HRIS CS - 1010', 'Structured HRIS Solution Campaign', 'Structured HRIS Solution', 'Ensure HRIS evaluation timeline is captured in months.', 'active');

-- 4. Initial Sample Campaign Value Propositions
INSERT INTO `campaign_value_propositions` (`id`, `campaign_id`, `value_proposition`, `sort_order`) VALUES
(1, 1, 'We help IT leaders migrate legacy applications to modern cloud architectures with minimal downtime and enhanced security.', 1),
(2, 1, 'Our multi-cloud migration suite ensures automated compliance and zero data loss across AWS, Azure, and Google Cloud.', 2),
(3, 2, 'We help HR teams identify and implement HRIS solutions that improve employee data management, HR process automation, and workforce management.', 1);

-- ==============================================================================
-- End of Script
-- ==============================================================================
