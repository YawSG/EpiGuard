import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Create OpenAI client with error handling
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
};

export async function POST(request) {
  try {
    const openai = getOpenAIClient();
    const body = await request.json();

    if (!body.message || !Array.isArray(body.history)) {
      throw new Error('Missing required fields in request');
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are EpiGuard, a helpful and empathetic medical assistant. Your goal is to collect information about patient symptoms and determine if they need to stay home or seek medical attention. You might need to do some translating. Always respond in the following JSON format:

{
  "message": "(your conversational response)",
  "symptoms": [{"symptom": "symptom name", "severity": "High/Moderate/Low"}],
  "riskLevel": "High/Moderate/Low",
  "symptomActions": {
    "remove": ["symptom to remove"],
    "update": [{"symptom": "symptom name", "severity": "new severity"}],
    "add": [{"symptom": "new symptom", "severity": "severity level"}]
  }
}

When managing symptoms:
- Add new symptoms when they are mentioned
- Remove symptoms that the patient says have resolved
- Update severity of existing symptoms when changes are mentioned
- Keep track of symptom progression over time

Risk Level Guidelines:
- High: Severe symptoms, multiple moderate symptoms, or signs of immediate medical concern
- Moderate: Single moderate symptom or multiple mild symptoms
- Low: Mild or no symptoms

Key severe symptoms: seizures, status epilepticus, prolonged confusion, severe head injury
Key moderate symptoms: aura, mild seizure, dizziness, temporary confusion
Mild symptoms: fatigue, mild headache, anxiety

Maintain a supportive and professional tone. Never break character or mention being an AI.`
        },
        ...body.history,
        { role: "user", content: body.message }
      ]
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('Invalid response from OpenAI');
    }

    try {
      const parsedResponse = JSON.parse(responseContent);

      if (!parsedResponse.message) {
        throw new Error('Invalid response format from AI');
      }

      return NextResponse.json(parsedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseContent);
      return NextResponse.json({
        message: responseContent,
        symptoms: [],
        riskLevel: "Low",
        symptomActions: { add: [], remove: [], update: [] }
      });
    }
  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    return NextResponse.json(
      {
        error: error.message || 'Failed to process the request',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}