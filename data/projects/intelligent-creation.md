---
title: intelligent creation tools — experiments in spatial and generative interfaces
subtitle: 2024
images:
  - /assets/images/projects/intelligent-creation/pointandcreate.png
  - /assets/images/projects/intelligent-creation/adscript1.jpeg
  - /assets/images/projects/intelligent-creation/adscript2.jpeg
technologies: ["Python", "Streamlit", "OpenCV", "MediaPipe", "GPT-4o", "OpenAI API"]
---

I’ve been exploring how AI can move beyond text boxes and become a more natural creative partner — tools that understand context, space, and what the user is actually doing. Over the past year, I built several prototypes to test this idea from different angles: spatial grounding, gesture-based interaction, and fast content generation. These projects helped me sharpen both my technical range (Python, CV, Next.js, LLM APIs) and my product intuition for what makes an “intelligent tool” feel useful instead of gimmicky.


# point & create — a spatially-grounded ai assistant

[view on github](https://github.com/samuelrobson4/creative_assistant)

## inspiration
I wanted to understand what AI could do when it’s not just responding to text, but to the **physical world**. That led to a simple question: *what if you could point at something, and the AI would understand exactly what you meant?* The goal wasn’t to build a polished product — it was to explore how multimodal models behave when tied to gestures, live video, and spatial context.

## what i built
Point & Create is a **Streamlit-based prototype** that lets users point at an object in their webcam feed and get a grounded response from GPT-4o based on the exact region they’re gesturing toward.  

I built:
- A real-time gesture-tracking pipeline with **MediaPipe**
- Dynamic region cropping with **OpenCV**
- A multimodal inference loop sending both **images + text** to GPT-4o  
- A lightweight, responsive **Streamlit UI** for fast iteration

Everything runs locally in Python with clean modular structure, making it easy to extend with voice, overlays, or IoT integrations.

## challenges & solutions
- **Reliable pointing detection across lighting and angles**  
  Solved with adaptive thresholding, smoothed bounding boxes, and filtering for stable hand keypoints.

- **Latency low enough for real-time interaction**  
  Optimized by processing frames *only when a pointing gesture is detected*, significantly reducing load.

- **Building a simple but expressive UX**  
  Kept the interface minimal and focused: live feed, cropped region, and grounded model response.

## outcome / lessons learned
The prototype demonstrated that spatially grounded AI can feel intuitive with the right feedback loop. It became a useful sandbox for testing multimodal behavior, interpretability overlays, and ideas for future tangible assistants — from cooking guidance to hardware repair help.


# ad script generator — fast content ideation for SMBs

## inspiration
Small businesses spend a surprising amount of time writing ads. I wanted to test whether a lightweight generative tool could remove that friction without requiring them to learn new workflows.

## what i built
A **Next.js web app** that generates short advertising scripts based on a business’s product details. It was built as an early experiment with generative models (GPT-3.5) and served as a simple proof of concept for speeding up content production.

The stack included:
- **Next.js + JavaScript** for the frontend
- **HTML/CSS** for a clean, simple UI
- **OpenAI API** for script generation

## challenges & solutions
- **Integrating early-stage generative APIs**  
  Built defensive prompt templates and validation to keep output on-brand and coherent.

- **Ensuring script quality and relevance**  
  Added structured inputs and guardrails to help the model stay focused on benefits, tone, and audience.

- **Managing POC constraints**  
  Scoped tightly: generate scripts well first, expand features later.

## outcome / lessons learned
The tool reduced ad-writing time by an estimated **50–70%** in early tests and validated the opportunity for fast-creation tools for SMBs. It also gave me a practical foundation in deploying generative applications and designing interfaces around model limitations.