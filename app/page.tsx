"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  FileAudio,
  Loader2,
  Mic,
  Newspaper,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  Video
} from "lucide-react";
import type { MediaAsset, NewsItem, Project, SubtitleCue } from "@/lib/types";

type ApiState = "idle" | "loading" | "error";
type ViewMode = "news" | "script" | "audio" | "video";

const statusLabel: Record<string, string> = {
  NEWS_SELECTED: "ニュース選択済み",
  SCRIPT_GENERATED: "台本生成済み",
  SCRIPT_APPROVED: "台本保存済み",
  AUDIO_UPLOADED: "音声保存済み",
  TRANSCRIBED: "字幕生成済み",
  ASSETS_COLLECTED: "素材準備済み",
  VIDEO_PROCESSING: "動画生成中",
  VIDEO_COMPLETED: "完成",
  VIDEO_FAILED: "失敗",
  PUBLISHED: "投稿済み"
};

const tones = [
  ["simple", "簡単"],
  ["natural", "自然"],
  ["shorter", "短く"],
  ["impact", "強め"],
  ["objective", "客観"]
];

const workflow = [
  { key: "news", label: "ニュース選択", detail: "5件から1件を選ぶ" },
  { key: "script", label: "台本", detail: "大きく確認して編集" },
  { key: "audio", label: "音声", detail: "録音またはアップロード" },
  { key: "video", label: "字幕・素材・動画", detail: "字幕と素材を作って生成" },
  { key: "done", label: "動画確認", detail: "プレビューと保存" }
] as const;

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [state, setState] = useState<ApiState>("idle");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("simple");
  const [view, setView] = useState<ViewMode>("news");
  const [recording, setRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    void load();
  }, []);

  const currentStep = useMemo(() => {
    if (!project) return 0;
    if (["NEWS_SELECTED"].includes(project.status)) return 1;
    if (["SCRIPT_GENERATED", "SCRIPT_APPROVED"].includes(project.status)) return 2;
    if (["AUDIO_UPLOADED"].includes(project.status)) return 3;
    if (["TRANSCRIBED", "ASSETS_COLLECTED", "VIDEO_PROCESSING", "VIDEO_FAILED"].includes(project.status)) return 4;
    return 5;
  }, [project]);

  const nextAction = useMemo(() => {
    if (!project) return "まずニュースを1件選んでください。";
    if (project.status === "SCRIPT_GENERATED") return "台本を確認して、必要なら編集して保存してください。";
    if (project.status === "SCRIPT_APPROVED") return "英語音声を録音またはアップロードしてください。";
    if (project.status === "AUDIO_UPLOADED") return "文字起こしと字幕生成を実行してください。";
    if (project.status === "TRANSCRIBED") return "背景素材を準備してください。";
    if (project.status === "ASSETS_COLLECTED") return "動画生成を実行してください。";
    if (project.status === "VIDEO_FAILED") return "エラー内容を確認して、動画生成を再実行してください。";
    if (project.status === "VIDEO_COMPLETED") return "完成動画を確認してMP4を保存できます。";
    return "次の制作ステップへ進んでください。";
  }, [project]);

  async function api<T>(url: string, init?: RequestInit): Promise<T> {
    setState("loading");
    setMessage("");
    const response = await fetch(url, init);
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok) {
      setState("error");
      setMessage(json.error || "処理に失敗しました。ページを更新してもう一度試してください。");
      throw new Error(json.error || "Request failed");
    }
    setState("idle");
    return json;
  }

  async function load() {
    try {
      const newsData = await api<{ news: NewsItem[] }>("/api/news");
      setNews(newsData.news);
      const projectData = await api<{ projects: Project[] }>("/api/projects");
      setProject((current) => current ?? projectData.projects[0] ?? null);
    } catch {
      setNews([]);
    }
  }

  async function refreshNews() {
    try {
      const data = await api<{ news: NewsItem[] }>("/api/news", { method: "POST" });
      setNews(data.news);
      setMessage("ニュース候補を更新しました。");
    } catch {
      setNews([]);
    }
  }

  async function selectNews(newsId: string) {
    const data = await api<{ project: Project }>("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newsId })
    });
    setProject(data.project);
    await generateScript(data.project.id);
    setView("script");
  }

  async function generateScript(projectId = project?.id) {
    if (!projectId) return;
    const data = await api<{ project: Project }>(`/api/projects/${projectId}/script`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tone })
    });
    setProject(data.project);
    setMessage("英語台本を生成しました。");
  }

  async function saveScript() {
    if (!project) return;
    const data = await api<{ project: Project }>(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scriptEn: project.scriptEn,
        scriptJa: project.scriptJa,
        pronunciationGuide: project.pronunciationGuide,
        status: "SCRIPT_APPROVED"
      })
    });
    setProject(data.project);
    setMessage("台本を保存しました。");
    setView("audio");
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioPreview(URL.createObjectURL(blob));
      await uploadAudio(new File([blob], "recording.webm", { type: "audio/webm" }));
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function uploadAudio(file: File) {
    if (!project) return;
    const form = new FormData();
    form.append("audio", file);
    const data = await api<{ project: Project }>(`/api/projects/${project.id}/audio`, { method: "POST", body: form });
    setProject(data.project);
    setMessage("音声を保存しました。");
    setView("audio");
  }

  async function transcribe() {
    if (!project) return;
    const data = await api<{ project: Project; cues: SubtitleCue[] }>(`/api/projects/${project.id}/transcribe`, { method: "POST" });
    setProject(data.project);
    setCues(data.cues);
    setMessage("字幕タイミングを生成しました。");
    setView("video");
  }

  async function collectAssets() {
    if (!project) return;
    const data = await api<{ project: Project; assets: MediaAsset[] }>(`/api/projects/${project.id}/assets`, { method: "POST" });
    setProject(data.project);
    setAssets(data.assets);
    setMessage("背景素材を準備しました。");
    setView("video");
  }

  async function makeVideo() {
    if (!project) return;
    const data = await api<{ project: Project }>(`/api/projects/${project.id}/video`, { method: "POST" });
    setProject(data.project);
    setMessage("動画を生成しました。");
    setView("video");
  }

  return (
    <main className="min-h-screen bg-[#f4f2ec] text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-[#f4f2ec]/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-teal-700 dark:text-teal-300">Now</p>
            <h1 className="text-xl font-black sm:text-2xl">{workflow[Math.min(currentStep, workflow.length - 1)].label}</h1>
          </div>
          <div className="min-w-0 flex-1 lg:max-w-3xl">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-neutral-500">
              <span>{statusLabel[project?.status || ""] || "未開始"}</span>
              <span>{nextAction}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {workflow.map((step, index) => (
                <button
                  key={step.key}
                  className={`h-2 rounded-full transition ${index <= currentStep ? "bg-teal-700" : "bg-neutral-200 dark:bg-neutral-800"} ${view === step.key ? "ring-2 ring-teal-300 ring-offset-2 ring-offset-[#f4f2ec] dark:ring-offset-neutral-950" : ""}`}
                  aria-label={step.label}
                  onClick={() => step.key !== "done" && setView(step.key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className={`mx-auto grid w-full gap-4 px-4 py-4 sm:px-6 lg:px-8 ${view === "script" ? "max-w-[112rem] lg:grid-cols-[220px_minmax(0,1fr)]" : "max-w-[96rem] lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className={`rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${view === "script" ? "p-3" : "p-4"}`}>
            <p className="text-xs font-bold uppercase text-teal-700 dark:text-teal-300">Daily workflow</p>
            <h1 className={`${view === "script" ? "mt-2 text-lg" : "mt-2 text-2xl"} font-black leading-tight`}>Japan News Shorts Studio</h1>
            <p className={`${view === "script" ? "mt-2 text-xs leading-5" : "mt-2 text-sm leading-6"} text-neutral-600 dark:text-neutral-300`}>
              5件から選ぶ、読む、確認する。毎日使うための制作ボードです。
            </p>
            <div className={`${view === "script" ? "mt-3" : "mt-5"} space-y-2`}>
              {workflow.map((step, index) => (
                <button
                  key={step.key}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${index <= currentStep ? "bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100" : "text-neutral-500"} ${view === step.key ? "outline outline-2 outline-teal-600" : ""}`}
                  disabled={step.key === "done"}
                  onClick={() => step.key !== "done" && setView(step.key)}
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${index <= currentStep ? "bg-teal-700 text-white" : "bg-neutral-200 dark:bg-neutral-800"}`}>
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-black">{step.label}</span>
                    <span className="block text-xs opacity-75">{step.detail}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className={`${view === "script" ? "mt-3 p-2 text-xs leading-5" : "mt-5 p-3 text-sm leading-6"} rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}>
              {nextAction}
            </div>
          </div>

          <div className={`mt-4 rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${view === "script" ? "p-3" : "p-4"}`}>
            <SectionTitle icon={<Video size={20} />} title="完成動画" status={project?.status} />
            {project?.videoPath ? (
              <div className="mt-4 grid gap-3">
                <video className={`mx-auto aspect-[9/16] rounded-md bg-black ${view === "script" ? "max-h-[220px]" : "max-h-[300px]"}`} src={toMediaUrl(project.videoPath) || undefined} controls />
                <a className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-3 text-sm font-black text-white" href={toMediaUrl(project.videoPath) || "#"} download>
                  <Download size={18} />
                  MP4
                </a>
                {project.subtitlePath && (
                  <a className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-200 px-4 py-3 text-sm font-black dark:border-neutral-700" href={toMediaUrl(project.subtitlePath) || "#"} download>
                    <Download size={18} />
                    字幕
                  </a>
                )}
              </div>
            ) : (
              <div className={`mt-4 rounded-lg border border-dashed border-neutral-300 text-sm leading-6 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300 ${view === "script" ? "p-3" : "p-4"}`}>
                完成したらここに表示します。
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-5">
          {view === "news" && (
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-neutral-500">{new Date().toLocaleDateString("ja-JP", { dateStyle: "full" })}</p>
                <h2 className="text-2xl font-black">本日のニュース候補 上位5件</h2>
              </div>
              <Button label="ニュース再取得" onClick={refreshNews} icon={state === "loading" ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />} />
            </div>

            {message && (
              <div className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${state === "error" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-teal-200 bg-teal-50 text-teal-900"}`}>
                {state === "error" && <AlertCircle className="mt-0.5 shrink-0" size={16} />}
                <span>{message}</span>
              </div>
            )}

            <div className="mt-4 grid gap-3">
              {news.map((item, index) => (
                <article key={item.id} className="rounded-lg border border-neutral-200 bg-[#fbfaf7] p-4 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-neutral-950 text-sm font-black text-white dark:bg-white dark:text-neutral-950">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span className="rounded-md bg-teal-100 px-2 py-1 font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-100">{item.category}</span>
                        <span>{item.sourceName}</span>
                        <span>{new Date(item.publishedAt).toLocaleString("ja-JP")}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-black leading-snug">{item.titleJa}</h3>
                      <p className="mt-1 text-sm font-bold text-teal-700 dark:text-teal-300">{item.titleEn}</p>
                      <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{item.summaryJa}</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <Score label="重要度" value={item.importanceScore} />
                        <Score label="動画化" value={item.videoSuitabilityScore} />
                        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-3 text-sm font-black text-white hover:bg-teal-800" onClick={() => selectNews(item.id)}>
                          これで作る
                          <ChevronRight size={18} />
                        </button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-neutral-500">{item.selectionReason}</p>
                    </div>
                  </div>
                </article>
              ))}
              {!news.length && (
                <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                  ニュース候補を取得できていません。ニュース再取得を押してください。外部取得に失敗した場合はモック候補へ戻ります。
                </div>
              )}
            </div>
          </div>
          )}

          {project && view === "script" && (
            <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4">
              <SectionTitle icon={<Sparkles size={20} />} title="台本編集" status={project.status} />
              {project.news && (
                <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm leading-5 text-teal-950 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-50">
                  <p className="font-black">{project.news.titleJa}</p>
                  <p className="mt-1 font-bold">{project.news.titleEn}</p>
                </div>
              )}
              <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {tones.map(([value, label]) => (
                    <button key={value} className={`rounded-md border px-3 py-2 text-sm font-bold ${tone === value ? "border-teal-700 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100" : "border-neutral-200 dark:border-neutral-700"}`} onClick={() => setTone(value)}>
                      {label}
                    </button>
                  ))}
                  <Button label="再生成" onClick={() => generateScript()} icon={<RefreshCw size={18} />} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Metric label="単語数" value={`${project.wordCount || project.scriptEn.split(/\s+/).filter(Boolean).length} words`} />
                  <Metric label="想定尺" value={`${project.estimatedDuration || 60} sec`} />
                </div>
              </div>
              <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase text-neutral-500">English script</h3>
                    <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">60 sec format</span>
                  </div>
                  <textarea className="h-[calc(100vh-305px)] min-h-[600px] w-full rounded-lg border border-neutral-200 bg-[#fbfaf7] p-5 text-lg font-semibold leading-8 outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 sm:text-xl sm:leading-9 xl:min-h-[660px]" value={project.scriptEn} onChange={(event) => setProject({ ...project, scriptEn: event.target.value })} />
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase text-neutral-500">日本語訳</h3>
                    <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">構成確認</span>
                  </div>
                  <textarea className="h-[calc(100vh-305px)] min-h-[600px] w-full rounded-lg border border-neutral-200 bg-[#fbfaf7] p-5 text-base font-semibold leading-8 outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 xl:min-h-[660px]" value={project.scriptJa} onChange={(event) => setProject({ ...project, scriptJa: event.target.value })} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button label="ニュースに戻る" onClick={() => setView("news")} icon={<Newspaper size={18} />} />
                <Button label="台本を保存" onClick={saveScript} icon={<Save size={18} />} strong />
              </div>
            </div>
          )}

          {project && view === "audio" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <SectionTitle icon={<Mic size={20} />} title="音声" status={project.status} />
                <div className="mt-4 flex flex-wrap gap-2">
                  {!recording ? (
                    <Button label="録音開始" onClick={startRecording} icon={<Mic size={18} />} strong />
                  ) : (
                    <Button label="録音停止" onClick={stopRecording} icon={<Check size={18} />} strong />
                  )}
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-black dark:border-neutral-700 dark:bg-neutral-950">
                    <Upload size={18} />
                    アップロード
                    <input className="sr-only" type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && uploadAudio(event.target.files[0])} />
                  </label>
                </div>
                {(audioPreview || project.audioPath) && <audio controls className="mt-4 w-full" src={audioPreview || toMediaUrl(project.audioPath) || undefined} />}
                <div className="mt-4">
                  <Button label="文字起こしと字幕生成" onClick={transcribe} icon={<FileAudio size={18} />} />
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="text-lg font-black">読み上げる台本</h2>
                <div className="mt-4 max-h-[460px] overflow-auto rounded-lg bg-[#fbfaf7] p-5 text-xl font-semibold leading-10 dark:bg-neutral-950">
                  {project.scriptEn || "台本がまだありません。"}
                </div>
              </div>
            </div>
          )}

          {project && view === "video" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <SectionTitle icon={<Video size={20} />} title="字幕・素材・動画" status={project.status} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button label="背景素材を準備" onClick={collectAssets} icon={<Sparkles size={18} />} />
                  <Button label="動画生成" onClick={makeVideo} icon={state === "loading" ? <Loader2 className="animate-spin" size={18} /> : <Video size={18} />} strong />
                </div>
                <div className="mt-4 grid gap-3">
                  <PreviewBox title="字幕プレビュー">
                    {cues.length ? cues.slice(0, 6).map((cue) => <p key={cue.index}>{cue.text}</p>) : <p>文字起こし後に表示されます。</p>}
                  </PreviewBox>
                  <PreviewBox title="背景素材">
                    {assets.length ? assets.map((asset) => <p key={asset.id}>{asset.source} / {asset.license}</p>) : <p>未準備。汎用背景にフォールバックします。</p>}
                  </PreviewBox>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="text-lg font-black">動画化チェック</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <ChecklistItem done={Boolean(project.audioPath)} label="音声が保存されている" />
                  <ChecklistItem done={Boolean(project.transcription)} label="字幕タイミングが生成されている" />
                  <ChecklistItem done={assets.length > 0 || project.status === "ASSETS_COLLECTED" || project.status === "VIDEO_COMPLETED"} label="背景素材が準備されている" />
                  <ChecklistItem done={project.status === "VIDEO_COMPLETED"} label="MP4が完成している" />
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function SectionTitle({ icon, title, status }: { icon: React.ReactNode; title: string; status?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-black">{icon}{title}</h2>
      {status && <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{statusLabel[status] || status}</span>}
    </div>
  );
}

function Button({ label, icon, onClick, strong = false }: { label: string; icon: React.ReactNode; onClick: () => void; strong?: boolean }) {
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black transition ${strong ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-neutral-200 bg-white hover:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950"}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold"><span>{label}</span><span>{value}</span></div>
      <div className="mt-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-2 rounded-full bg-teal-700" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-[#fbfaf7] p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-bold text-neutral-500">{label}</div>
      <div className="mt-1 text-base font-black">{value}</div>
    </div>
  );
}

function PreviewBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-[#fbfaf7] p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="text-sm font-black">{title}</h3>
      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{children}</div>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-md px-3 py-2 ${done ? "bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-50" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}>
      <span className={`grid h-6 w-6 place-items-center rounded-full ${done ? "bg-teal-700 text-white" : "bg-neutral-300 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"}`}>
        {done ? <Check size={15} /> : "•"}
      </span>
      <span className="font-bold">{label}</span>
    </div>
  );
}

function toMediaUrl(filePath: string | null | undefined) {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, "/");
  const marker = "/storage/";
  const index = normalized.lastIndexOf(marker);
  if (index >= 0) return `/api/media/${normalized.slice(index + marker.length)}`;
  const windowsMarker = "storage/";
  const fallbackIndex = normalized.lastIndexOf(windowsMarker);
  return fallbackIndex >= 0 ? `/api/media/${normalized.slice(fallbackIndex + windowsMarker.length)}` : null;
}
