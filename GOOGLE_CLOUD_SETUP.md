# Google Cloud Speech-to-Text Setup Guide

## 🔑 Getting Google Cloud Free Tier Credits

Google Cloud Speech-to-Text offers a **free tier** that's perfect for testing:

- **Free tier**: 60 minutes of transcription per month
- **No credit card required** for free tier usage
- **Automatic speech recognition** with word-level timestamps

## 🚀 Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click "Select a project" → "New Project"
4. Enter project name (e.g., "transcript-processor")
5. Click "Create"

### 2. Enable Speech-to-Text API

1. In the Google Cloud Console, search for "Speech-to-Text API"
2. Click on "Cloud Speech-to-Text API"
3. Click "Enable" if not already enabled
4. Wait for the API to be enabled (may take a few minutes)

### 3. Create Service Account & Credentials

1. Go to [https://console.cloud.google.com/iam-admin/serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "Create Service Account"
3. Enter service account details:
   - Name: `transcript-service`
   - Description: `Service account for transcript processing`
4. Click "Create and Continue"
5. Skip adding roles for now (we'll add specific permissions)
6. Click "Done"

### 4. Generate JSON Key File

1. Click on your newly created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Select "JSON" key type
5. Click "Create"
6. **Important**: Download the JSON file immediately - you won't be able to download it again
7. Rename it to `google-credentials.json` and move it to your project root

### 5. Set Environment Variable

**For Windows (PowerShell):**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\google-credentials.json"
```

**For Windows (Command Prompt):**
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\google-credentials.json
```

**For permanent setup (recommended):**
1. Right-click "This PC" → "Properties" → "Advanced system settings"
2. Click "Environment Variables"
3. Under "User variables", click "New"
4. Variable name: `GOOGLE_APPLICATION_CREDENTIALS`
5. Variable value: Full path to your `google-credentials.json` file
6. Click "OK" to save

### 6. Grant Required Permissions

1. Go to [https://console.cloud.google.com/iam-admin/iam](https://console.cloud.google.com/iam-admin/iam)
2. Find your service account (`transcript-service`)
3. Click the pencil icon to edit
4. Click "Add Role"
5. Add "Cloud Speech-to-Text User" role
6. Click "Save"

### 7. Verify Setup

Run this command to verify your credentials are working:
```bash
gcloud auth application-default login
```

Or test with a simple Node.js script:
```javascript
const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();
console.log('Google Cloud Speech-to-Text client initialized successfully!');
```

## 🎯 Usage Limits

### Free Tier (Monthly)
- **60 minutes** of Speech-to-Text processing
- **No credit card required**
- **Automatic reset** each month

### Paid Tier (if needed)
- **$0.006 per 15 seconds** for standard recognition
- **$0.009 per 15 seconds** for enhanced models
- **Pay-as-you-go** billing

## 🔧 Troubleshooting

### "Credentials not configured" Error
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set
- Verify the JSON file path is correct
- Check that the JSON file has proper permissions

### "Quota exceeded" Error
- You've used your 60-minute free tier limit
- Wait for monthly reset or upgrade to paid tier
- Check your usage at [Google Cloud Console](https://console.cloud.google.com/)

### "Billing not enabled" Error
- For free tier, billing should not be required
- If prompted, you may need to enable a free trial billing account
- Google offers $300 free credit for new accounts

### API Not Enabled
- Go to [APIs & Services](https://console.cloud.google.com/apis/dashboard)
- Search for "Cloud Speech-to-Text API"
- Click "Enable" if not already enabled

## 📝 Alternative: Local Development

For development without Google Cloud, you can also use:
- **Local Whisper models** (completely free, requires Python setup)
- **AssemblyAI** (3 hours free tier)
- **Hugging Face Spaces** (free tier available)

## 🚀 Next Steps

Once setup is complete:
1. Restart your development server
2. Upload an audio file to test transcription
3. Monitor your usage in Google Cloud Console
4. Enjoy 60 minutes of free transcription per month!