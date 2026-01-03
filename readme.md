# Real-Time AI Chat App (Next.js + Gemini API)

This is a real-time AI chatbot template built using **Next.js (App Router)** and **Gemini API**.  
It streams AI responses to the frontend in real time, providing a smooth and interactive chat experience similar to ChatGPT or Gemini.

---

## Features
- Real-time streaming AI responses  
- Built with Next.js App Router  
- Clean and simple UI design  
- Gemini API integration  
- Frontend and backend connected using stream API  
- Modular and production-ready structure  
- Easy to customize and extend  

---

## Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Gemini API
- React Hooks
- Edge Runtime / Server Actions

---

## Folder Structure
\`\`\`
app/
 ├── api/
 │   └── chat/
 │        └── route.ts          -> Handles backend streaming logic
 ├── components/
 │   └── ChatView.tsx           -> Main chat UI component
 ├── layout.tsx
 ├── page.tsx                   -> Entry point

public/
 ├── preview.png (optional)

.env.local (to be created by user)
\`\`\`

---

## Environment Variables
Create a \`.env.local\` file in the project root and add the following:

\`\`\`
GEMINI_API_KEY=your_gemini_api_key_here
\`\`\`

You can get your API key from:  
[gemini ai studio](https://aistudio.google.com/)

---

## How It Works
1. The frontend component (\`ChatView.tsx\`) takes user input and sends it to \`/api/chat\`.
2. The backend (\`route.ts\`) receives the request, sends it to Gemini API, and reads the response as a stream.
3. The chunks of text from Gemini are decoded and streamed back to the frontend.
4. The frontend continuously updates the assistant message as new data arrives.
5. The user sees the AI typing in real time, similar to ChatGPT.

---

## Setup and Run
\`\`\`bash
# Install dependencies
npm install

# Run the development server
npm run dev
\`\`\`

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Preview
The app streams AI responses in real time, making the chat experience feel fast and natural.

---

## Included Files
- Complete Next.js project (App Router)
- ChatView.tsx (frontend chat component)
- API route for streaming responses
- Tailwind setup
- Example environment file
- Preview image (optional)
- Documentation

---

## Notes
You can use this template to:
- Learn how to implement streaming with Gemini API
- Build your own AI chat app
- Create commercial projects (as per Gumroad license terms)

---

## Author
Created by Jignesh Zala
Website: [jigsdev](https://jigsdev.xyz/)  
Newsletter: [newsletter](https://jigsdev.beehiiv.com/)

