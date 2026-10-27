/**
 * Microsoft sign-in with UPT accounts (the API's README, "Sign-in"). Web, mobile and the API are one
 * Entra app registration in UPT's tenant, so one client id. Neither value is a secret.
 */
import { makeRedirectUri, type DiscoveryDocument } from 'expo-auth-session'

export const TENANT_ID = '6bb41fe4-40a3-4a10-b6cd-38278e78b21a'
export const CLIENT_ID = 'bc1d7e77-6fb2-48ab-a4d5-2fd2ac7080fc'

/** `profile` for the name and email in the token, `offline_access` for the refresh token. */
export const SCOPES = ['openid', 'profile', 'offline_access', `api://${CLIENT_ID}/access_as_user`]

/** Registered under "Mobile and desktop applications"; PKCE makes a code caught here useless. */
export const REDIRECT_URI = makeRedirectUri({ native: 'campuspulse://auth' })

/** The tenant's own endpoints: a single-tenant app refuses `/common` (AADSTS50194). */
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`
export const discovery: DiscoveryDocument = {
  authorizationEndpoint: `${AUTHORITY}/authorize`,
  tokenEndpoint: `${AUTHORITY}/token`,
  endSessionEndpoint: `${AUTHORITY}/logout`,
}
