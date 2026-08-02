"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
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

const steps = ["News", "Script", "Audio", "Subtitles", "Video"];

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [state, setState] = useState<ApiState>("idle");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("simple");
  const [recording, setRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    void load();
  }, []);

  const activeStep = useMemo(() => {
    if (!project) return 0;
    if (project.status === "NEWS_SELECTED") return 1;
    if (["SCRIPT_GENERATED", "SCRIPT_APPROVED"].includes(project.status)) return 2;
    if (project.status === "AUDIO_UPLOADED") return 3;
    if (["TRANSCRIBED", "ASSETS_COLLECTED", "VIDEO_PROCESSING", "VIDEO_FAILED"].includes(project.status)) return 4;
    return 4;
  }, [project]);

  async function api<T>(url: string, init?: RequestInit): Promise<T> {
    setState("loading");
    setMessage("");
    const response = await fetch(url, init);
    const json = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(json.error || "処理に失敗しました。");
      throw new Error(json.error || "Request failed");
    }
    setState("idle");
    return json;
  }

  async function load() {
    const [newsData, projectData] = await Promise.all([
      api<{ news: NewsItem[] }>("/api/news"),
      api<{ projects: Project[] }>("/api/projects")
    ]);
    setNews(newsData.news);
    setProjects(projectData.projects);
    setProject(projectData.projects[0] ?? null);
  }

  async function refreshNews() {
    const data = await api<{ news: NewsItem[] }>("/api/news", { method: "POST" });
    setNews(data.news);
    setMessage("ニュース候補を更新しました。");
  }

  async function selectNews(newsId: string) {
    const data = await api<{ project: Project }>("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newsId })
    });
    setProject(data.project);
    await generateScript(data.project.id);
    await load();
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
  }

  async function transcribe() {
    if (!project) return;
    const data = await api<{ project: Project; cues: SubtitleCue[] }>(`/api/projects/${project.id}/transcribe`, { method: "POST" });
    setProject(data.project);
    setCues(data.cues);
    setMessage("字幕タイミングを生成しました。");
  }

  async function collectAssets() {
    if (!project) return;
    const data = await api<{ project: Project; assets: MediaAsset[] }>(`/api/projects/${project.id}/assets`, { method: "POST" });
    setProject(data.project);
    setAssets(data.assets);
    setMessage("背景素材を準備しました。");
  }

  async function makeVideo() {
    if (!project) return;
    const data = await api<{ project: Project }>(`/api/projects/${project.id}/video`, { method: "POST" });
    setProject(data.project);
    setMessage("動画を生成しました。");
    await load();
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 dark:border-neutral-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-action">Japan News Shorts Studio</p>
              <h1 className="mt-1 text-3xl font-bold tracking-normal sm:text-4xl">今日の日本ニュースを30秒英語Shortsへ</h1>
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-300">{new Date().toLocaleDateString("ja-JP", { dateStyle: "full" })}</div>
          </div>
          <div className="flex items-center gap-2" aria-label="制作ステップ">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className={`step-dot ${index <= activeStep ? "active" : ""}`} />
                <span className="hidden text-xs font-semibold sm:inline">{step}</span>
              </div>
            ))}
          </div>
        </header>

        {message && (
          <div className={`rounded-md border px-4 py-3 text-sm ${state === "error" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-teal-200 bg-teal-50 text-teal-900"}`}>
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
          <section className="flex flex-col gap-6">
            <Panel title="1. ニュース候補" icon={<Newspaper size={20} />} action={<IconButton label="ニュース再取得" onClick={refreshNews} icon={<RefreshCw size={18} />} />}>
              <div className="grid gap-3">
                {news.map((item) => (
                  <article key={item.id} className="rounded-md border border-line bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-neutral-100 px-2 py-1 font-semibold dark:bg-neutral-800">{item.category}</span>
                        <span>{item.sourceName}</span>
                        <span>{new Date(item.publishedAt).toLocaleString("ja-JP")}</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">{item.titleJa}</h2>
                        <p className="mt-1 text-sm font-semibold text-action">{item.titleEn}</p>
                      </div>
                      <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">{item.summaryJa}</p>
                      <div className="grid gap-2 text-sm sm:grid-cols-3">
                        <Score label="重要度" value={item.importanceScore} />
                        <Score label="動画化" value={item.videoSuitabilityScore} />
                        <div className="text-xs text-neutral-600 dark:text-neutral-300">{item.selectionReason}</div>
                      </div>
                      <button className="rounded-md bg-action px-4 py-3 text-sm font-bold text-white" onClick={() => selectNews(item.id)}>
                        このニュースで作る
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>

            {project && (
              <Panel title="2. 台本編集" icon={<Sparkles size={20} />}>
                <div className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["simple", "簡単"],
                      ["natural", "自然"],
                      ["shorter", "短く"],
                      ["impact", "強め"],
                      ["objective", "客観"]
                    ].map(([value, label]) => (
                      <button key={value} className={`rounded-md border px-3 py-2 text-sm ${tone === value ? "border-action bg-teal-50 text-action" : "border-line"}`} onClick={() => setTone(value)}>
                        {label}
                      </button>
                    ))}
                    <IconButton label="再生成" onClick={() => generateScript()} icon={<RefreshCw size={18} />} />
                  </div>
                  <textarea className="min-h-44 rounded-md border border-line bg-white p-3 leading-7 dark:border-neutral-700 dark:bg-neutral-900" value={project.scriptEn} onChange={(event) => setProject({ ...project, scriptEn: event.target.value })} />
                  <textarea className="min-h-28 rounded-md border border-line bg-white p-3 leading-7 dark:border-neutral-700 dark:bg-neutral-900" value={project.scriptJa} onChange={(event) => setProject({ ...project, scriptJa: event.target.value })} />
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <Metric label="単語数" value={`${project.wordCount || project.scriptEn.split(/\s+/).filter(Boolean).length} words`} />
                    <Metric label="想定尺" value={`${project.estimatedDuration || 30} sec`} />
                    <Metric label="ステータス" value={project.status} />
                  </div>
                  <pre className="whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">{project.pronunciationGuide || "発音ガイドは台本生成後に表示されます。"}</pre>
                  <IconButton label="台本を保存" onClick={saveScript} icon={<Save size={18} />} strong />
                </div>
              </Panel>
            )}

            {project && (
              <Panel title="3. 音声" icon={<Mic size={20} />}>
                <div className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    {!recording ? (
                      <IconButton label="録音開始" onClick={startRecording} icon={<Mic size={18} />} strong />
                    ) : (
                      <IconButton label="録音停止" onClick={stopRecording} icon={<Check size={18} />} strong />
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm font-bold dark:border-neutral-700 dark:bg-neutral-900">
                      <Upload size={18} />
                      音声アップロード
                      <input className="sr-only" type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && uploadAudio(event.target.files[0])} />
                    </label>
                  </div>
                  {(audioPreview || project.audioPath) && <audio controls className="w-full" src={audioPreview || toMediaUrl(project.audioPath) || undefined} />}
                  <IconButton label="文字起こしと字幕生成" onClick={transcribe} icon={<FileAudio size={18} />} />
                </div>
              </Panel>
            )}

            {project && (
              <Panel title="4. 動画生成" icon={<Video size={20} />}>
                <div className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    <IconButton label="背景素材を準備" onClick={collectAssets} icon={<Sparkles size={18} />} />
                    <IconButton label="動画生成" onClick={makeVideo} icon={state === "loading" ? <Loader2 className="animate-spin" size={18} /> : <Video size={18} />} strong />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-line p-3 dark:border-neutral-700">
                      <h3 className="text-sm font-bold">字幕プレビュー</h3>
                      <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                        {(cues.length ? cues : []).slice(0, 8).map((cue) => (
                          <p key={cue.index}>{cue.text}</p>
                        ))}
                        {!cues.length && <p>文字起こし後に字幕が表示されます。</p>}
                      </div>
                    </div>
                    <div className="rounded-md border border-line p-3 dark:border-neutral-700">
                      <h3 className="text-sm font-bold">背景素材</h3>
                      <div className="mt-2 space-y-2 text-sm">
                        {(assets.length ? assets : []).map((asset) => (
                          <p key={asset.id}>{asset.source} / {asset.license}</p>
                        ))}
                        {!assets.length && <p className="text-neutral-600 dark:text-neutral-300">未準備。見つからない場合は汎用背景にフォールバックします。</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            )}
          </section>

          <aside className="flex flex-col gap-6">
            <Panel title="完成動画" icon={<Video size={20} />}>
              {project?.videoPath ? (
                <div className="grid gap-3">
                  <video className="mx-auto aspect-[9/16] max-h-[640px] rounded-md bg-black" src={toMediaUrl(project.videoPath) || undefined} controls />
                  <a className="inline-flex items-center justify-center gap-2 rounded-md bg-action px-4 py-3 text-sm font-bold text-white" href={toMediaUrl(project.videoPath) || "#"} download>
                    <Download size={18} />
                    MP4ダウンロード
                  </a>
                  {project.subtitlePath && (
                    <a className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-3 text-sm font-bold" href={toMediaUrl(project.subtitlePath) || "#"} download>
                      <Download size={18} />
                      字幕ファイル
                    </a>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-line p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                  生成後、ここに縦型プレビューが表示されます。
                </div>
              )}
            </Panel>

            <Panel title="過去の動画" icon={<Check size={20} />}>
              <div className="space-y-3">
                {projects.map((item) => (
                  <button key={item.id} className="w-full rounded-md border border-line bg-white p-3 text-left text-sm dark:border-neutral-700 dark:bg-neutral-900" onClick={() => setProject(item)}>
                    <span className="block font-bold">{item.news?.titleEn || item.shortsTitle || item.id}</span>
                    <span className="mt-1 block text-xs text-neutral-600 dark:text-neutral-300">{item.status} / {new Date(item.updatedAt).toLocaleString("ja-JP")}</span>
                  </button>
                ))}
                {!projects.length && <p className="text-sm text-neutral-600 dark:text-neutral-300">まだ履歴はありません。</p>}
              </div>
            </Panel>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function IconButton({ label, icon, onClick, strong = false }: { label: string; icon: React.ReactNode; onClick: () => void; strong?: boolean }) {
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold ${strong ? "bg-action text-white" : "border border-line bg-white dark:border-neutral-700 dark:bg-neutral-900"}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold"><span>{label}</span><span>{value}</span></div>
      <div className="mt-1 h-2 rounded bg-neutral-200 dark:bg-neutral-800"><div className="h-2 rounded bg-action" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
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
