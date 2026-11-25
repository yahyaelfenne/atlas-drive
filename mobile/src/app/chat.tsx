import { streamChat } from "../lib/chat-stream";
import { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from "react-native";
import { useApp } from "../lib/session";
import { Button, Chips, colors, ErrorMessage, Field, styles } from "../components/ui";
interface Message {
  role: "assistant" | "user";
  text: string;
  source?: string;
}
export default function Chat() {
  const { user } = useApp();
  if (user?.role === "Admin") return <Redirect href="/admin" />;
  return <Conversation key={user?.id || "guest"} />;
}
function Conversation() {
  const { baseUrl } = useApp();
  const [language, setLanguage] = useState("auto");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Bonjour ! Parlez-moi dans votre langue : location, voyage, traduction ou question générale.",
    },
  ]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chatRequest = useRef<AbortController | null>(null);
  useEffect(() => () => chatRequest.current?.abort(), []);
  const list = useRef<ScrollViewInstance>(null);
  async function send() {
    if (!value.trim() || busy) return;
    const question = value.trim();
    setValue("");
    setError("");
    setBusy(true);
    const answerIndex = messages.length + 1;
    setMessages(previous => [...previous, { role: "user", text: question }, { role: "assistant", text: "" }]);
    chatRequest.current = new AbortController();
    try {
      await streamChat(baseUrl + "/api/chat/stream", {
        message: question, language,
        history: messages.slice(1).filter(m => m.text).slice(-8).map(m => ({ role: m.role, content: m.text.slice(0, 1800) })),
      }, (text, source) => setMessages(previous => previous.map((item, i) => i === answerIndex ? { ...item, text, source } : item)), chatRequest.current.signal);
    } catch (e) {
      setError((e as Error).message);
      setValue(question);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={list}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => {
          list.current?.scrollToEnd({ animated: true });
        }}
      >
        <Text style={styles.label}>LÀ POUR VOUS ACCOMPAGNER</Text>
        <Chips value={language} onChange={setLanguage} options={[["auto", "Auto"], ["fr", "Français"], ["ary", "Darija"], ["ar", "العربية"], ["en", "English"], ["es", "Español"], ["de", "Deutsch"], ["it", "Italiano"], ["pt", "Português"]].map(([value, label]) => ({ value, label }))} />
        <Button title="Nouvelle discussion" secondary disabled={busy} onPress={() => setMessages([{ role: "assistant", text: "Bonjour ! Posez votre question dans votre langue." }])} />
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.card,
              {
                backgroundColor:
                  message.role === "user" ? colors.ink : colors.white,
                marginLeft: message.role === "user" ? 32 : 0,
                marginRight: message.role === "assistant" ? 18 : 0,
              },
            ]}
          >
            <Text
              style={{
                color: message.role === "user" ? colors.white : colors.ink,
                fontSize: 16,
                lineHeight: 25,
                writingDirection: /[\u0600-\u06ff]/.test(message.text) ? "rtl" : "auto",
              }}
            >
              {message.text || (busy ? "Préparation de la réponse…" : "")}
            </Text>
            {Boolean(message.source) && (
              <Text style={styles.small}>
                {message.source === "openai" || message.source === "ollama"
                  ? "Assistant conversationnel"
                  : "Mode secours : aide location limitée"}
              </Text>
            )}
          </View>
        ))}
        <ErrorMessage message={error} />
      </ScrollView>
      <View
        style={{
          padding: 16,
          gap: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Field
          label="Votre message"
          placeholder="Posez votre question dans votre langue…"
          value={value}
          onChangeText={setValue}
          multiline
          maxLength={2000}
        />
        <Button
          title="Envoyer"
          disabled={!value.trim()}
          busy={busy}
          onPress={send}
        />
        <Text style={styles.small}>
          Votre contrat fait référence pour les conditions de location.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
