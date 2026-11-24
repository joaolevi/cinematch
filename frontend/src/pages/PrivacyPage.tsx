import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-6">{children}</div>
    </section>
  );
}

/** Política de privacidade (RNFF08). Aberta para quem ainda não tem conta, porque o cadastro aponta para cá. */
export default function PrivacyPage() {
  usePageTitle("Política de privacidade");
  const { user } = useAuth();
  const account = user ? (
    <Link to="/conta" className="underline hover:text-[#b9452f]">
      Minha conta
    </Link>
  ) : (
    "Minha conta"
  );
  return (
    <div className="paper relative mx-auto max-w-3xl -rotate-[0.2deg] space-y-7 rounded-sm py-8 pr-8 pl-16 text-[#2b211c]">
      <span aria-hidden className="tape -top-2.5 left-14 -rotate-6" style={{ background: TAPE_COLORS[1] }} />
      <div>
        <p className="font-hand text-2xl font-bold text-[#b9452f]">Combinado é combinado,</p>
        <h1 className="text-3xl font-bold">Política de privacidade</h1>
        <p className="mt-2 text-sm">
          O Tastory é um protótipo acadêmico, feito na disciplina de Gerência de Projeto 2026.2 da UFAL. Aqui está o que
          ele guarda sobre você, por quê e o que você pode fazer com isso, como pede a Lei Geral de Proteção de Dados
          (LGPD). Atualizada em 24/11/2026.
        </p>
      </div>

      <Part title="O que guardamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Nome, e-mail e senha. A senha fica cifrada: nem a equipe consegue lê-la.</li>
          <li>O seu diário: o que você viu ou ouviu, com notas, resenhas e datas.</li>
          <li>As suas listas, as preferências do começo e os ajustes que você faz no próprio gosto.</li>
          <li>Quem você segue, os serviços de streaming que você marcou e quem pode ver os seus registros.</li>
          <li>As sugestões que apareceram na sua tela e o que você fez com elas, como Quero ver ou Não me interesso.</li>
          <li>Se você participa dos experimentos e em qual grupo está.</li>
        </ul>
      </Part>

      <Part title="Para que usamos">
        <p>
          Para montar as suas sugestões, mostrar o seu diário e os seus registros na Comunidade, conforme você escolher.
          Essa é a base do serviço que você pede ao criar a conta (art. 7º, V, da LGPD).
        </p>
        <p>
          Para os experimentos, que comparam duas formas de sugerir e medem quanto as sugestões são aceitas: só com o
          seu consentimento (art. 7º, I). Você escolhe no cadastro, e a caixa começa desmarcada. Dá para sair ou voltar
          quando quiser, em {account}. Sem os experimentos, você recebe as sugestões completas, e as suas reações ficam
          fora da comparação.
        </p>
      </Part>

      <Part title="Quem vê">
        <p>
          Os seus registros aparecem na Comunidade, no seu perfil e nas resenhas de cada título. Em {account}, você
          escolhe quem vê: todos, só quem segue você ou só você. Seguir não pede aceite, então, para esconder de todo
          mundo, use "Só eu".
        </p>
        <p>
          A administração vê nome, e-mail e resenhas, para moderar e cuidar das contas. Não vendemos nem passamos os
          seus dados para ninguém.
        </p>
      </Part>

      <Part title="Serviços de fora">
        <p>
          O servidor busca dados de filmes, séries e álbuns no TMDB, na JustWatch (pelo TMDB) e no MusicBrainz. Essas
          consultas levam só o nome ou o código do título, nunca dados seus.
        </p>
        <p>
          As fontes de letra da interface vêm do Google Fonts: ao abrir o site, o seu navegador as baixa do Google, que
          recebe o seu endereço de internet, como acontece em qualquer site que usa essas fontes.
        </p>
        <p>
          O navegador guarda a sua sessão e quando lembrar de pedir uma nota. Não usamos cookies de propaganda nem
          ferramentas de rastreamento.
        </p>
      </Part>

      <Part title="Por quanto tempo">
        <p>
          Enquanto a conta existir. Ao excluir a conta, apagamos na hora tudo o que é dela. As cópias de segurança do
          banco, feitas pela equipe, podem guardar os dados de antes da exclusão até serem descartadas.
        </p>
      </Part>

      <Part title="Os seus direitos">
        <p>Tudo isto está em {account}, sem precisar pedir para ninguém:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Baixar tudo o que guardamos sobre você, num arquivo (acesso e portabilidade).</li>
          <li>
            Corrigir o diário a qualquer momento e o que o Tastory acha do seu gosto, em{" "}
            {user ? (
              <Link to="/meu-gosto" className="underline hover:text-[#b9452f]">
                Corrigir meu gosto
              </Link>
            ) : (
              "Corrigir meu gosto"
            )}
            .
          </li>
          <li>Escolher quem vê os seus registros.</li>
          <li>Sair dos experimentos, o que retira o consentimento.</li>
          <li>Excluir a conta e tudo o que é dela.</li>
        </ul>
        <p>
          Para qualquer outra dúvida, fale com a equipe pelo{" "}
          <a href="https://github.com/joaolevi/cinematch/issues" target="_blank" rel="noreferrer" className="underline hover:text-[#b9452f]">
            repositório do projeto
          </a>
          .
        </p>
      </Part>
    </div>
  );
}
