# Transcript Processor Setup

## Environment Variables

This application uses **AssemblyAI** (3 hours free per month).

### AssemblyAI API Key Setup (Required)

1. Add your AssemblyAI API key to `.env.local`:
   ```
   ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
   ```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Add your AssemblyAI API key to `.env.local`

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Features

- **File Upload**: Upload audio or video files for transcription
- **Dynamic Settings**: Configure exclusions, exceptions, and output formats
- **Multiple Output Formats**: 
  - Text with Timestamps
  - SRT Subtitles
  - VTT Subtitles
  - JSON Structured
  - Markdown Format
- **Prompt Formats**: Standard, Detailed, Concise, Professional, Custom
- **Real-time Processing**: Uses AssemblyAI with speaker diarization and timestamps
- **Free Tier**: 3 hours of transcription per month at no cost
- **Speaker Detection**: Automatically identifies different speakers

## Usage

1. Click "Show Settings" to configure your transcription preferences
2. Set up exclusions (words to remove) and exceptions (words to keep)
3. Choose your preferred prompt and output formats
4. Upload your audio/video file
5. Click "Generate Transcript" to process
6. Download the edited transcript in your chosen format

## Service Options

- **AssemblyAI** (Current): 3 hours free/month, speaker diarization, excellent accuracy
- **Google Cloud Speech-to-Text**: 60 minutes free/month, high accuracy
- **OpenAI Whisper**: Paid service, excellent accuracy (requires API key)
- **Local Whisper**: Completely free, requires local setup

## Troubleshooting

- Verify the `ASSEMBLYAI_API_KEY` in `.env.local` is correct
- Check your AssemblyAI dashboard for usage and quota limits
- Ensure audio files are in supported formats (MP3, WAV, M4A, etc.)