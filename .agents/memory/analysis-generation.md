---
name: Geração de análises longas
description: Regra para gerar e validar análises astrológicas extensas com vários tópicos.
---

Análises astrológicas extensas não devem depender de uma única resposta longa do modelo. Dividir os tópicos em blocos paralelos reduz truncamentos e o tempo total; a aplicação deve validar os headings obrigatórios e os marcadores do Combo de Entrega antes de salvar `completed`.

**Why:** Respostas longas podem aparentar estar completas, mas terminar no meio dos tópicos; além disso, a rota de regeneração retorna imediatamente enquanto a geração assíncrona continua.

**How to apply:** Ao alterar o conjunto de tópicos, atualize a validação de seções, mantenha a geração em blocos com ordem determinística ao juntar os resultados e teste o conteúdo persistido, não apenas o status retornado pela chamada de regeneração.