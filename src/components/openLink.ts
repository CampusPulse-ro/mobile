import * as WebBrowser from 'expo-web-browser'
import { Linking } from 'react-native'

/** Opens a web page in the in-app browser, or the phone's browser when that isn't available. */
export function openLink(url: string): void {
  void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined))
}
