# Build iOS do Agendei

Este projeto usa Capacitor para gerar o app nativo iOS. Diferente do Android, o iOS nao gera APK; o pacote instalavel para aparelhos Apple e um `.ipa`.

## Estrutura

- Projeto Xcode: `ios/App/App.xcodeproj`
- Bundle id: `br.com.gnsilvicultura.app`
- App name: `GN Silvicultura`
- URL carregada pelo app: `https://agendei-rho.vercel.app`

## Comandos

```bash
npm run ios:sync
npm run ios:open
```

Para tentar um build local de simulador:

```bash
npm run ios:build:sim
```

## Gerar IPA

Para gerar um `.ipa`, abra o projeto com `npm run ios:open`, selecione o target `App` no Xcode e configure:

- Team da Apple Developer Account
- Signing & Capabilities com assinatura automatica
- Provisioning profile valido para `br.com.gnsilvicultura.app`

Depois use `Product > Archive` e distribua por TestFlight ou exporte o IPA.

## Observacao de ambiente

No ambiente atual nao ha identidade de assinatura Apple configurada (`0 valid identities found`). Sem certificado e provisioning profile, o projeto iOS pode ser gerado e sincronizado, mas um `.ipa` instalavel nao pode ser assinado localmente.
