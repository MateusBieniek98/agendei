# Identidade de marca Talhivo

Status: identidade de trabalho aprovada internamente em 14/09/2026. O uso
comercial externo depende das etapas jurídicas descritas em `NAMING_BRIEF.md`.

## Arquitetura

- Marca do produto: **Talhivo**.
- Descritor: **Gestão operacional florestal**.
- Assinatura: **Do campo à gestão.**
- Empresa usuária: aparece como contexto operacional, nunca como marca global.
- Exemplo dentro do sistema: `Talhivo` no produto e `Operação GN` no contexto.

Essa separação é obrigatória no modelo multiempresa. Logo, nome, cor ou dados de
um cliente não podem substituir a identidade Talhivo nem aparecer para outro
cliente.

## Conceito do símbolo

O monograma une a letra `T` a duas linhas convergentes de plantio. A construção
remete a talhão, direção e controle operacional sem usar árvore, folha ou imagem
genérica de tecnologia. O desenho deve permanecer geométrico e sem efeitos.

## Paleta

| Papel | Cor | Hex |
| --- | --- | --- |
| Marca principal | Pinheiro profundo | `#173F35` |
| Ação e confirmação | Verde operacional | `#2F7455` |
| Navegação e texto | Grafite | `#18211F` |
| Fundo claro | Névoa | `#F3F5F2` |
| Destaque pontual | Âmbar operacional | `#D6A23A` |
| Apoio gerencial | Azul petróleo | `#315F6D` |

O âmbar é reservado a seleção, atenção e pequenos detalhes. Estados de
erro e sucesso continuam usando cores semânticas próprias.

## Tipografia e interface

- Fonte: pilha nativa do sistema, para leitura rápida e baixo custo de rede.
- Títulos: peso 600; corpo: 400 ou 500; números operacionais: tabulares.
- Cantos: até 8 px nas superfícies do sistema.
- Sombras: discretas; hierarquia prioritariamente por borda, espaço e contraste.
- Linguagem: direta, curta e orientada à tarefa.
- Evitar: gradientes decorativos, folhas, árvores genéricas, excesso de pílulas,
  slogans diferentes e associação visual exclusiva a um cliente.

## Ativos no repositório

- `components/branding/Logo.tsx`: símbolo e assinatura usados na interface.
- `public/icon.svg`: ícone canônico da PWA e fonte dos ativos nativos.
- `lib/product-brand.ts`: nome, descritor, assinatura e cores oficiais.
- `app/manifest.ts`: identidade instalada da PWA.

O identificador nativo `br.com.gnsilvicultura.app` e o prefixo local
`forestry-ops` permanecem temporariamente estáveis por compatibilidade. Eles não
são marca pública e só devem mudar com um plano de migração que preserve o app
instalado, as sessões e a fila offline.
