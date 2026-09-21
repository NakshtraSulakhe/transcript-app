# AssemblyAI Setup Guide

## 🔑 Getting AssemblyAI Free Tier Credits

AssemblyAI offers a **generous free tier** that's perfect for testing:

- **Free tier**: 3 hours of transcription per month
- **No credit card required** for free tier usage
- **Automatic speech recognition** with speaker diarization
- **High accuracy** with advanced features

## 🚀 Step-by-Step Setup

### 1. Create AssemblyAI Account

1. Go to [https://www.assemblyai.com/](https://www.assemblyai.com/)
2. Click "Sign Up" in the top right corner
3. Sign up using:
   - Google account
   - GitHub account
   - Email and password
4. Verify your email if required

### 2. Get Your API Key

1. After signing up, you'll be redirected to the dashboard
2. Click on "API Key" in the left sidebar
3. You'll see your API key (it looks like: `a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2`)
4. **Copy the API key** - you'll need it for the next step

### 3. Add API Key to Your Project

1. Open your `.env.local` file in the project root
2. Add your API key:
   ```
   ASSEMBLYAI_API_KEY=your_actual_assemblyai_api_key_here
   ```
3. Save the file

### 4. Verify Setup

Your setup is complete! The application will automatically use your API key when you upload files for transcription.

## 🎯 Usage Limits

### Free Tier (Monthly)
- **3 hours** of audio transcription
- **No credit card required**
- **Automatic reset** each month
- **Full feature access** including speaker diarization

### Paid Tier (if needed)
- **$0.00025 per second** for standard transcription
- **$0.00060 per second** for enhanced models
- **Pay-as-you-go** billing
- **Unlimited usage** with custom plans

## 🎁 AssemblyAI Features

### Included in Free Tier
- **Speaker Diarization**: Automatically identifies different speakers
- **Timestamps**: Word-level and sentence-level timing
- **Punctuation**: Automatic punctuation and capitalization
- **Content Safety**: Detects sensitive content
- **Topic Detection**: Identifies main topics in audio
- **Sentiment Analysis**: Analyzes emotional tone

### Supported Audio Formats
- **Audio**: MP3, WAV, M4A, OGG, FLAC, WEBM
- **Video**: MP4, MOV, AVI, MKV (audio extracted)
- **Max file size**: 5GB for free tier
- **Max duration**: Unlimited for paid tier

## 🔧 Troubleshooting

### "API key not configured" Error
- Ensure `ASSEMBLYAI_API_KEY` is set in `.env.local`
- Verify the API key is copied correctly (no extra spaces)
- Check that the API key is still active in your AssemblyAI dashboard

### "Quota exceeded" Error
- You've used your 3-hour free tier limit for the month
- Wait for monthly reset or upgrade to paid tier
- Check your usage at [AssemblyAI Dashboard](https://www.assemblyai.com/dashboard)

### "Upload failed" Error
- Check audio file format is supported
- Ensure file size is under 5GB (free tier limit)
- Verify your internet connection is stable

### Poor Transcription Quality
- Ensure audio quality is good (clear, minimal background noise)
- Check that the language is set correctly (default: English)
- Try with a shorter audio sample for testing

## 📊 Monitoring Usage

1. Go to [AssemblyAI Dashboard](https://www.assemblyai.com/dashboard)
2. Check your current usage and remaining free tier hours
3. View transcription history and results
4. Monitor API usage patterns

## 🚀 Next Steps

Once setup is complete:
1. Restart your development server
2. Upload an audio file to test transcription
3. Monitor your usage in AssemblyAI Dashboard
4. Enjoy 3 hours of free transcription per month!

## 💡 Tips for Best Results

- **Audio Quality**: Use clear, high-quality audio recordings
- **File Format**: MP3 or WAV work best
- **Speaker Count**: Set expected number of speakers for better diarization
- **Background Noise**: Minimize noise for better accuracy
- **File Size**: Keep files under 100MB for faster processing

## 🆚 Alternative Services

If AssemblyAI doesn't meet your needs:
- **Local Whisper**: 100% free, requires Python setup
- **Google Cloud**: 60 minutes free/month, high accuracy
- **OpenAI Whisper**: Paid, excellent accuracy
- **Hugging Face**: Free tier available, more complex setup