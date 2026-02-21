# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vive Gamer** is a multiplayer AI-powered drawing/guessing party game (inspired by Gartic Phone). AI acts as an opponent or imperfect translator rather than replacing human creativity. The project is currently in its initial phase — no code has been written yet.

## Game Modes

### 1. AI Decoding Battle (Asymmetric Mode)
- One human draws a secret prompt; other humans + AI (Nano Banana multimodal) guess simultaneously
- Scoring: highest points for drawings that humans can guess but AI cannot
- Strategic tension: exploit human-specific context/humor that AI misses

### 2. Prompt Teleport (AI Telephone)
- Chain: Human (text) → AI (image gen) → Human (describe image) → Human (write prompt) → AI (image gen)
- Style Cards (80s retro, claymation, cyberpunk, etc.) distributed to players; AI applies style transfer
- Cost optimization: Flash model during play, Pro model only for final reveal (4K + text compositing)

### 3. Speed Sketch Fix (Interactive Inpainting)
- AI generates incomplete images; all players simultaneously draw missing parts
- AI composites all drawings via inpainting every 15 seconds

## Architecture Decisions

### Cost & Latency Optimization
- **2×2 sub-image grid**: prompt AI to output 4 images in one 4K generation, then split — ~75% cost reduction per image
- **Flash vs Pro tiering**: Gemini 2.5 Flash Image ($0.039/image, <2s) during gameplay; Gemini 3 Pro Image ($0.134–$0.24/image) with thinking for final reveals
- Keep per-session API costs low by defaulting to Flash for all intermediate generations

### Real-time Infrastructure
- **WebSocket required** for real-time canvas sync — serverless won't work for persistent connections
- Target deployment: serverfull platform (Render or dedicated server)
- **Redis Pub/Sub** for multi-player canvas state synchronization with low latency

### Language: Japanese
- Primary user-facing language is Japanese
- UI text, prompts, and game instructions should be in Japanese
