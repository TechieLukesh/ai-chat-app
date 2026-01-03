import ChatView from "../../../components/chat-view";

type Props = {
  params: { id: string };
};

export default function ChatPage({ params }: Props) {
  // Pass the route conversation id into the ChatView so it can load that convo's history
  return <ChatView conversationId={params.id} />;
}
