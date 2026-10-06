import { ChatApp } from "@/components/chat-app";

export default function HomePage() {
  return <ChatApp calendarUrl={process.env.CALENDAR_URL ?? ""} />;
}
