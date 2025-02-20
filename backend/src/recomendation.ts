import OpenAI from 'openai';
import { Event } from './types';
import User from './user/models/User';
import moment from 'moment-timezone';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const CHUNK_SIZE = 10;
const seen = new Set();

export const getEventChunks = (events: Event[], chunkSize: number): Event[][] => {
  const chunks: Event[][] = [];
  for (let i = 0; i < events.length; i += chunkSize) {
    chunks.push(events.slice(i, i + chunkSize));
  }
  return chunks;
};

export const getRecommendations = async (chunk: Event[], userPreferences: { spendingLimit?: number; hobbies?: string[]; userName?: string; userPrompt?: string; likedEvents?: { title: string; date: string; message: string; ticketLink: string; }[]; dislikedEvents?: { title: string; date: string; message: string; ticketLink: string; }[] }): Promise<{title: string; date: string; venue: string; ticketLink: string; message: string; score: number }[]> => {
  const currentDate = moment().tz('Asia/Almaty').format('YYYY-MM-DD'); // Текущая дата в Казахстане
  const currentTime = moment().tz('Asia/Almaty').format('HH:mm'); // Текущее время в Казахстане
  const currentDay = moment().tz('Asia/Almaty').format('dddd'); // Текущий день недели

  console.log(`Current Date: ${currentDate}, Time: ${currentTime}, Day: ${currentDay}`);
  
  chunk.forEach(event => {
    console.log("Title : ", event.title, "Price : ", event.price, "Date : ", event.date);
  });

  const systemPrompt = `
  I have provided a chunk of up to 10 events.
  Pay special attention to the user's hobbies and budget.
  First, prioritize popularity - more than 1000 is considered normal in popularity.
  Then check if it matches preferences, using tags as a guide.
  Thirdly, ensure the event's price does not exceed the user's budget by more than 3,000 tenge.
  Balance selection for preferences and quantity.
  Select as many events as you see fit based on the given criteria.
  User's budget: ${userPreferences.spendingLimit}
  User's hobbies: ${JSON.stringify(userPreferences.hobbies)}
  Take attention on Liked events: ${JSON.stringify(userPreferences.likedEvents)}, but don't use them in recommendations.
  Lean on it also on Disliked events: ${JSON.stringify(userPreferences.dislikedEvents)}
  Events: ${JSON.stringify(chunk)}
  Current Date: ${currentDate}

  Recommend the most relevant events, sorted by relevance, in a list of creative, interesting, and engaging messages with all necessary details, including date, time, venue, ticket link, appropriate emojis related to the event, and a relevance score from 1 to 100.
  Use the user's name ${userPreferences.userName} in the message explaining why they should attend each event. Respond in a casual and humorous tone. Make jokes, use fun language, and avoid being too formal. Be a friendly SMM specialist who's fun to talk to.
  Ensure the event price does not exceed the user's budget by more than 3000 tenge.
  Avoid repeating events in the recommendations.
  Do not invent new events, only use the provided events.
  Do not change the dates of the events. Use the provided dates exactly as they are.
  Discard any events that do not fit the user's preferences based on the provided criteria.
  Return the response as a valid array of objects, each with keys "title", "date", "venue", "ticketLink", "message", and "score" containing the formatted event details and relevance score.
  Use date in format "DD.MM.YYYY".
  Don't create new events, use only provided events.
  Give answer only on russian or kazakh language.
  If there is user's prompt, use it in the response and don't take attention on user's hobbies and budget.
  If you can't find any events, return an empty array.
  If the user prompt contains references to the "ИК" group, it means he is looking for "Ирина Кайратовна".
  

  Example:
  [
    {
      "title": "JONY Concert",
      "date": "22.09.2024",
      "venue": "Almaty Arena, мкр. Нуркент, 7",
      "ticketLink": "https://sxodim.com/almaty/kontserty/solnyy-koncert-jony/tickets",
      "message": "🔥 Готовы погрузиться в мир эмоций и драйва? 🔥\\n\\nСольный концерт JONY уже совсем скоро! 🎉\\n\\n🗓️ 22.09.2024\\n💰 20000 тг\\n**⏰ 20:00\\n📍 Almaty Arena, мкр. Нуркент, 7\\n\\n🎤 JONY исполнит свои самые популярные хиты, заставит вас петь и танцевать всю ночь напролет!\\n\\n🎫 Билеты уже в продаже: https://sxodim.com/almaty/kontserty/solnyy-koncert-jony/tickets \\n\\nНе пропустите это незабываемое событие! 💥",
      "score": 95
    }
  ]
`;



  console.log('Sending message for chunk...');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPreferences.userPrompt || '' },
      ],
    });
  
    let responseText = response.choices[0].message.content || '';
    console.log('Response:', responseText);
  
    // Убедимся, что удаляем не только управляющие символы, но и любые другие незначительные.
    responseText = responseText.replace(/```json|```/g, '').trim();
    responseText = responseText.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  
    const parsedResponse = JSON.parse(responseText);
  
    if (Array.isArray(parsedResponse)) {
      return parsedResponse;
    } else {
      console.warn('Unexpected response format:', parsedResponse);
      return [];
    }
  } catch (error) {
    console.error('Error during communication or parsing:', error);
    return [];
  }
  
}

const removeDuplicates = (recommendations) => {
  return recommendations.filter(event => {
    const duplicateCheck = `${event.title}_${event.date}_${event.venue}`;
    if (seen.has(duplicateCheck)) {
      return false;
    } else {
      seen.add(duplicateCheck);
      return true;
    }
  });
};
