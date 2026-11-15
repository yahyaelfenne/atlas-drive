import { useRef, useState } from "react";
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
  const { api } = useApp();
  const [language, setLanguage] = useState("auto");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Bonjour ! Une question sur les prix, la caution, les options ou votre réservation ?",
    },
  ]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<ScrollViewInstance>(null);
  async function send() {
    if (!value.trim() || busy) return;
    const question = value.trim();
    setValue("");
    setError("");
    setBusy(true);
    setMessages((previous) => [...previous, { role: "user", text: question }]);
    try {
      const answer = await api<{ reply: string; source: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: question, language }),
      });
      setMessages((previous) => [
        ...previous,
        { role: "assistant", text: answer.reply, source: answer.source },
      ]);
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
              {message.text}
            </Text>
            {Boolean(message.source) && (
              <Text style={styles.small}>
                {message.source === "openai"
                  ? "Assistant OpenAI"
                  : "Assistant local · FAQ"}
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
          placeholder="Comment fonctionne la caution ?"
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
