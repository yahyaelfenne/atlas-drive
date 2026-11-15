import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
export async function shareContract(html: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contrat-location-ennour.html";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: ".pdf",
      dialogTitle: "Contrat Location Ennour",
    });
  else await Print.printAsync({ uri: file.uri });
}
