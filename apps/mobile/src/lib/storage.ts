import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDesktopBridge } from "./desktop";

export default {
  getItem(key: string) {
    return getDesktopBridge()?.storage({ operation: "get", key }) ?? AsyncStorage.getItem(key);
  },
  setItem(key: string, value: string): Promise<void> {
    const bridge = getDesktopBridge();
    return bridge ? bridge.storage({ operation: "set", key, value }).then(() => {}) : AsyncStorage.setItem(key, value);
  },
  removeItem(key: string): Promise<void> {
    const bridge = getDesktopBridge();
    return bridge ? bridge.storage({ operation: "remove", key }).then(() => {}) : AsyncStorage.removeItem(key);
  },
};
