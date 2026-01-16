
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
type AspectRatio = "3:4" | "9:16" | "16:9";
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

type VisualStyle = 'Mimetizar' | 'Cinematic' | 'Minimalist' | 'Corporate' | 'Luxurious' | 'High-Tech';
type ColorPalette = 'Mimetizar' | 'Warm' | 'Cold' | 'Neutral' | 'Vibrant' | 'Dark';
type LightingType = 'Mimetizar' | 'Golden Hour' | 'Studio Soft' | 'Dramatic' | 'Natural' | 'Neon';

// --- Constants ---
const styleOptions: VisualStyle[] = ['Mimetizar', 'Cinematic', 'Minimalist', 'Corporate', 'Luxurious', 'High-Tech'];
const colorOptions: ColorPalette[] = ['Mimetizar', 'Warm', 'Cold', 'Neutral', 'Vibrant', 'Dark'];
const lightingOptions: LightingType[] = ['Mimetizar', 'Golden Hour', 'Studio Soft', 'Dramatic', 'Natural', 'Neon'];

interface CopyOption {
  header1: string;
  header2: string;
  header3: string;
  bodyText: string;
  cta: string;
  badgeText: string;
  strategy: string;
}

interface CopyState {
  header1: string;
  header2: string;
  header3: string;
  bodyText: string;
  cta: string;
  badgeText: string;
  removalInstructions: string;
  visualStyle: VisualStyle;
  colorPalette: ColorPalette;
  lightingType: LightingType;
}

interface GenerationState {
  specialistImage: string | null;
  productInfo: string;
  referenceImage: string | null;
  copy: CopyState;
  copyOptions: CopyOption[];
  selectedOptionIndex: number | null;
  ratio: AspectRatio;
  isGenerating: boolean;
  isAnalyzing: boolean;
  statusMessage: string;
  resultImage: string | null;
  error: string | null;
  currentStep: WizardStep;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const cleanBase64 = (b64: string) => b64.split(',')[1];

const App = () => {
  const getInitialState = (): GenerationState => ({
    specialistImage: localStorage.getItem('stored_specialist'),
    productInfo: localStorage.getItem('stored_product_info') || "",
    referenceImage: null,
    copy: { 
      header1: "", 
      header2: "", 
      header3: "", 
      bodyText: "", 
      cta: "", 
      badgeText: "",
      removalInstructions: "SUBSTITUIÇÃO TOTAL: Delete a pessoa da referência. Use APENAS o rosto/corpo do Especialista da Imagem 1. Remova logos e datas antigas.",
      visualStyle: 'Mimetizar',
      colorPalette: 'Mimetizar',
      lightingType: 'Mimetizar'
    },
    copyOptions: [],
    selectedOptionIndex: null,
    ratio: "9:16",
    isGenerating: false,
    isAnalyzing: false,
    statusMessage: "",
    resultImage: null,
    error: null,
    currentStep: 0
  });

  const [state, setState] = useState<GenerationState>(getInitialState());
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
        if (has) setState(p => ({ ...p, currentStep: 1 }));
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setState(p => ({ ...p, currentStep: 1 }));
    }
  };

  const resetProject = () => {
    // Evita a tela branca ao resetar limpando o estado de forma segura e voltando ao passo 1
    const fresh = getInitialState();
    setState({ ...fresh, currentStep: 1 });
  };

  const analyzeReference = async () => {
    if (!state.referenceImage) return;
    setState(prev => ({ ...prev, isAnalyzing: true, statusMessage: "Mapeando Estrutura Master...", error: null }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const analysisPrompt = `
        VOCÊ É UM EXPERT EM DESIGN E COPYWRITING DE ALTA CONVERSÃO.
        Analise a imagem de referência e crie 3 opções de copy para este produto: "${state.productInfo}".
        MAPEIE OS TEXTOS PARA EDIÇÃO:
        1. Headline Principal (em 3 partes).
        2. Texto de Descrição/Corpo.
        3. Selos, Badges ou Datas (badgeText).
        4. Botão (CTA).
        
        Crie 3 variações: Direta, Curiosidade e Autoridade.
        Retorne rigorosamente no formato JSON: { "copyOptions": [{ "header1", "header2", "header3", "bodyText", "cta", "badgeText", "strategy" }] }.
      `;

      const refPart = { inlineData: { mimeType: "image/png", data: cleanBase64(state.referenceImage) } };

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [refPart, { text: analysisPrompt }] },
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              copyOptions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    header1: { type: Type.STRING },
                    header2: { type: Type.STRING },
                    header3: { type: Type.STRING },
                    bodyText: { type: Type.STRING },
                    cta: { type: Type.STRING },
                    badgeText: { type: Type.STRING },
                    strategy: { type: Type.STRING }
                  },
                  required: ["header1", "bodyText", "strategy"]
                }
              }
            }
          }
        }
      });

      const text = response.text || "{}";
      const data = JSON.parse(text);
      
      setState(prev => ({ 
        ...prev, 
        isAnalyzing: false, 
        copyOptions: data.copyOptions || [],
        currentStep: 3
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isAnalyzing: false, error: "Falha na análise: " + err.message }));
    }
  };

  const selectCopyOption = (index: number) => {
    const opt = state.copyOptions[index];
    setState(prev => ({
      ...prev,
      selectedOptionIndex: index,
      copy: {
        ...prev.copy,
        header1: opt.header1 || "",
        header2: opt.header2 || "",
        header3: opt.header3 || "",
        bodyText: opt.bodyText || "",
        cta: opt.cta || "Saiba Mais",
        badgeText: opt.badgeText || ""
      },
      currentStep: 4
    }));
  };

  const generateImage = async (overrideCopy?: CopyState) => {
    if (!state.specialistImage || !state.referenceImage) return;
    
    const activeCopy = overrideCopy || state.copy;
    setState(prev => ({ ...prev, isGenerating: true, statusMessage: "Clonando Identidade e Aplicando Estilo Master...", error: null }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const visualDirective = `
        ${activeCopy.visualStyle === 'Mimetizar' ? "STRICT VISUAL MIMICRY: Replicate background and composition from Image 2." : `STYLE OVERRIDE: Apply a ${activeCopy.visualStyle} design theme.`}
        ${activeCopy.colorPalette === 'Mimetizar' ? "" : `COLOR SCHEME: Use ${activeCopy.colorPalette} colors dominated background.`}
        ${activeCopy.lightingType === 'Mimetizar' ? "" : `LIGHTING SETUP: Use ${activeCopy.lightingType} lighting effect.`}
      `;

      const identityPrompt = `
        CRITICAL IDENTITY REPLACEMENT RULE:
        - IDENTIDADE: Use APENAS o Especialista da IMAGEM 1. 
        - REFERÊNCIA: A IMAGEM 2 é apenas um guia de layout. IGNORE COMPLETAMENTE A PESSOA DENTRO DELA.
        - PROIBIÇÃO: Não use nada do rosto, cabelo ou corpo da pessoa da Imagem 2. Eles são um placeholder.
        - TRANSPLANTE: Pegue o Especialista da Imagem 1 e coloque-o na mesma posição da pessoa da Imagem 2, respeitando a iluminação do novo ambiente.

        TEXTOS (SUBSTITUA TUDO):
        1. Headline: "${activeCopy.header1} ${activeCopy.header2} ${activeCopy.header3}"
        2. Corpo do Texto: "${activeCopy.bodyText}"
        3. Selo/Info Extra: "${activeCopy.badgeText}"
        4. CTA do Botão: "${activeCopy.cta}"

        LIMPEZA: ${activeCopy.removalInstructions}. 
        Formato: ${state.ratio}. 4K Quality.
        ${visualDirective}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { 
            parts: [
                { text: "IMAGE 1: ESTA É A ÚNICA IDENTIDADE PERMITIDA (O CLONE/ESPECIALISTA)" },
                { inlineData: { mimeType: "image/png", data: cleanBase64(state.specialistImage) } },
                { text: "IMAGE 2: ESTA É APENAS O MAPA DE LAYOUT. DELETE A PESSOA QUE ESTÁ AQUI." },
                { inlineData: { mimeType: "image/png", data: cleanBase64(state.referenceImage) } },
                { text: identityPrompt }
            ]
        },
        config: { imageConfig: { aspectRatio: state.ratio, imageSize: "4K" } }
      });

      let img = "";
      for (const p of response.candidates?.[0]?.content?.parts || []) {
        if (p.inlineData) { img = `data:image/png;base64,${p.inlineData.data}`; break; }
      }

      if (img) setState(prev => ({ ...prev, isGenerating: false, resultImage: img, currentStep: 5 }));
      else throw new Error("A IA não gerou a imagem esperada.");
    } catch (err: any) {
      setState(prev => ({ ...prev, isGenerating: false, error: "Erro de geração: " + err.message }));
    }
  };

  const handleGenerateVariation = (opt: CopyOption) => {
    if (state.isGenerating) return;
    const updatedCopy: CopyState = { 
        ...state.copy, 
        header1: opt.header1, 
        header2: opt.header2, 
        header3: opt.header3, 
        bodyText: opt.bodyText, 
        cta: opt.cta || "Saiba Mais", 
        badgeText: opt.badgeText || "" 
    };
    setState(p => ({ ...p, copy: updatedCopy }));
    // Gera imediatamente com a nova copy para não depender da atualização assíncrona do state
    generateImage(updatedCopy);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {state.currentStep > 0 && (
        <header className="glass sticky top-0 z-50 px-6 py-4 border-b border-white/10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <i className="fa-solid fa-dna text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tighter leading-none">Clone <span className="text-blue-500">Master</span></h1>
                <p className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400">by Tata Gonçalves</p>
              </div>
            </div>
            
            <div className="hidden md:flex gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-black border transition-all ${state.currentStep === s ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-white/5 text-slate-500 border-white/5'}`}>{s}</div>
              ))}
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <i className="fa-solid fa-shield-halved"></i> Identidade Segura
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 flex flex-col">
        {/* STEP 0 */}
        {state.currentStep === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center animate-in zoom-in-95 duration-700">
            <div className="max-w-4xl">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500 mb-6 block">Identity Manipulation Lab</span>
              <h2 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.85] mb-12">
                CLONE SEU <br/><span className="text-blue-600">SUCESSO</span> <br/>EM 4K.
              </h2>
              <button onClick={handleOpenKeySelection} className="group relative inline-flex items-center justify-center px-16 py-8 font-black text-2xl uppercase tracking-tighter text-white transition-all bg-blue-600 rounded-[2.5rem] hover:bg-blue-500 shadow-2xl hover:-translate-y-1">
                Acessar Laboratório <i className="fa-solid fa-arrow-right ml-4 group-hover:translate-x-2 transition-transform"></i>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 */}
        {state.currentStep === 1 && (
          <div className="max-w-4xl mx-auto p-6 md:p-12 animate-in slide-in-from-bottom-10">
            <h2 className="text-4xl font-black mb-12 tracking-tighter text-center">Passo 1: <span className="text-blue-500">O Clone</span></h2>
            <div className="grid md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Avatar do Especialista</p>
                <div className="glass aspect-[4/5] rounded-[2.5rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-blue-500 transition-all shadow-2xl relative" onClick={() => document.getElementById('spec-upload')?.click()}>
                  {state.specialistImage ? <img src={state.specialistImage} className="w-full h-full object-cover" /> : <div className="text-center opacity-20"><i className="fa-solid fa-id-card-clip text-4xl mb-4"></i><p className="text-[10px] uppercase font-black">Upload Especialista</p></div>}
                  <input id="spec-upload" type="file" className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if(file) { const b64 = await fileToBase64(file); setState(p => ({...p, specialistImage: b64})); localStorage.setItem('stored_specialist', b64); } }} />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Briefing da Oferta</p>
                <div className="glass flex-1 p-6 rounded-[2.5rem] bg-white/5 border-white/5">
                  <textarea value={state.productInfo} onChange={(e) => setState(p => ({...p, productInfo: e.target.value}))} placeholder="Sobre o que é o seu anúncio?" className="w-full h-[200px] bg-transparent border-none outline-none text-sm resize-none font-medium leading-relaxed" />
                </div>
                <button disabled={!state.specialistImage || !state.productInfo} onClick={() => setState(p => ({...p, currentStep: 2}))} className="w-full bg-blue-600 py-6 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-500 transition-all mt-4 disabled:opacity-30">Continuar</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {state.currentStep === 2 && (
          <div className="max-w-4xl mx-auto p-6 md:p-12 text-center animate-in fade-in">
            <h2 className="text-4xl font-black mb-10 tracking-tighter">Passo 2: <span className="text-blue-500">O Mapa Visual</span></h2>
            <div className="glass aspect-[3/4] max-w-sm mx-auto rounded-[3rem] border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer overflow-hidden mb-12 hover:border-blue-500 transition-all group" onClick={() => document.getElementById('ref-upload')?.click()}>
              {state.referenceImage ? <img src={state.referenceImage} className="w-full h-full object-contain" /> : <div className="text-center opacity-20"><i className="fa-solid fa-photo-film text-4xl mb-4"></i><p className="text-[10px] font-black uppercase">Upload Referência</p></div>}
              <input id="ref-upload" type="file" className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if(file) { const b64 = await fileToBase64(file); setState(p => ({...p, referenceImage: b64})); } }} />
            </div>
            {state.referenceImage && <button onClick={analyzeReference} disabled={state.isAnalyzing} className="bg-blue-600 px-16 py-6 rounded-2xl font-black text-xl uppercase tracking-tighter shadow-2xl hover:bg-blue-500 transition-all">Analisar Estrutura</button>}
          </div>
        )}

        {/* STEP 3 */}
        {state.currentStep === 3 && (
          <div className="max-w-6xl mx-auto p-6 md:p-12 animate-in zoom-in-95">
            <h3 className="text-4xl font-black tracking-tighter mb-10 text-center">Passo 3: <span className="text-blue-500">Variações de Copy</span></h3>
            <div className="grid md:grid-cols-3 gap-6">
              {state.copyOptions.map((opt, i) => (
                <button key={i} onClick={() => selectCopyOption(i)} className="glass p-8 rounded-[3rem] text-left border-white/5 hover:border-blue-500/50 hover:bg-blue-600/5 transition-all flex flex-col h-full group">
                  <div className="mb-4 flex justify-between items-center"><span className="text-[9px] font-black bg-blue-600 px-3 py-1 rounded-full uppercase">Opção {i+1}</span></div>
                  <h4 className="text-xl font-black text-white mb-2 leading-tight">{opt.header1}</h4>
                  <p className="text-xs text-slate-500 italic mb-6 flex-1 line-clamp-4 leading-relaxed">{opt.bodyText}</p>
                  <div className="text-[8px] font-black uppercase text-blue-400 tracking-widest">{opt.strategy}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: CUSTOMIZATION (RESTORING ALL TOOLS) */}
        {state.currentStep === 4 && (
          <div className="max-w-7xl mx-auto p-6 md:p-12 animate-in zoom-in-95">
            <h2 className="text-4xl font-black text-center mb-12 tracking-tighter">Passo 4: <span className="text-blue-500">Direção Master</span></h2>
            <div className="grid lg:grid-cols-12 gap-10">
              
              <div className="lg:col-span-8 space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="glass p-4 rounded-2xl border-white/5"><p className="text-[8px] font-black uppercase opacity-30 mb-1">Headline 1</p><input value={state.copy.header1} onChange={e => setState(p => ({...p, copy: {...p.copy, header1: e.target.value}}))} className="w-full bg-transparent outline-none font-bold text-lg" /></div>
                  <div className="glass p-4 rounded-2xl border-white/5"><p className="text-[8px] font-black uppercase opacity-30 mb-1">Headline 2</p><input value={state.copy.header2} onChange={e => setState(p => ({...p, copy: {...p.copy, header2: e.target.value}}))} className="w-full bg-transparent outline-none font-bold text-lg" /></div>
                  <div className="glass p-4 rounded-2xl border-white/5"><p className="text-[8px] font-black uppercase opacity-30 mb-1">Headline 3</p><input value={state.copy.header3} onChange={e => setState(p => ({...p, copy: {...p.copy, header3: e.target.value}}))} className="w-full bg-transparent outline-none font-bold text-lg" /></div>
                </div>
                
                <div className="glass p-5 rounded-2xl border-white/5"><p className="text-[8px] font-black uppercase opacity-30 mb-2">Descrição da Oferta</p><textarea value={state.copy.bodyText} onChange={e => setState(p => ({...p, copy: {...p.copy, bodyText: e.target.value}}))} className="w-full bg-transparent outline-none text-sm leading-relaxed min-h-[100px] resize-none" /></div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="glass p-5 rounded-2xl border-blue-500/20 bg-blue-500/5"><p className="text-[8px] font-black uppercase text-blue-400 mb-2">Badge / Selo / Data / Info Extra</p><input value={state.copy.badgeText} onChange={e => setState(p => ({...p, copy: {...p.copy, badgeText: e.target.value}}))} placeholder="Texto que aparecerá no selo..." className="w-full bg-transparent outline-none font-bold text-white placeholder:opacity-20" /></div>
                  <div className="glass p-5 rounded-2xl border-white/5"><p className="text-[8px] font-black uppercase opacity-30 mb-2">Texto do Botão (CTA)</p><input value={state.copy.cta} onChange={e => setState(p => ({...p, copy: {...p.copy, cta: e.target.value}}))} className="w-full bg-transparent outline-none font-bold text-blue-400" /></div>
                </div>

                <div className="glass p-4 rounded-2xl border-red-500/20 bg-red-500/5">
                  <p className="text-[8px] font-black uppercase text-red-400 mb-2">Instruções de Remoção (O que tirar da referência?)</p>
                  <input value={state.copy.removalInstructions} onChange={e => setState(p => ({...p, copy: {...p.copy, removalInstructions: e.target.value}}))} placeholder="Ex: Tirar o fundo azul, remover logo da marca X..." className="w-full bg-transparent outline-none text-[11px] font-medium text-slate-300" />
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Formato</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(["3:4", "9:16", "16:9"] as AspectRatio[]).map(r => (
                      <button key={r} onClick={() => setState(p => ({...p, ratio: r}))} className={`p-4 rounded-2xl font-black border-2 text-[10px] transition-all ${state.ratio === r ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-white/5 border-white/10 opacity-30'}`}>
                        <span>{r}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* DIREÇÃO ARTÍSTICA - RESTAURADO */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estilo do Layout</h3>
                    <div className="flex flex-wrap gap-2">
                        {styleOptions.map(s => (<button key={s} onClick={() => setState(p => ({...p, copy: {...p.copy, visualStyle: s}}))} className={`px-3 py-2 rounded-xl text-[8px] font-black border uppercase transition-all ${state.copy.visualStyle === s ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/10 opacity-40 hover:opacity-100'}`}>{s}</button>))}
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 pt-2">Paleta de Cores (Fundo/Layout)</h3>
                    <div className="flex flex-wrap gap-2">
                        {colorOptions.map(c => (<button key={c} onClick={() => setState(p => ({...p, copy: {...p.copy, colorPalette: c}}))} className={`px-3 py-2 rounded-xl text-[8px] font-black border uppercase transition-all ${state.copy.colorPalette === c ? 'bg-emerald-600 border-emerald-400' : 'bg-white/5 border-white/10 opacity-40 hover:opacity-100'}`}>{c}</button>))}
                    </div>
                </div>

                <button onClick={() => generateImage()} disabled={state.isGenerating} className="w-full bg-blue-600 py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:bg-blue-500 transition-all uppercase tracking-tighter active:scale-95">
                  {state.isGenerating ? <i className="fa-solid fa-sync animate-spin mr-3"></i> : "Gerar Master Clone"}
                </button>
                <button onClick={() => setState(p => ({...p, currentStep: 3}))} className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-white transition-all">Trocar Estratégia de Copy</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: RESULTS */}
        {state.currentStep === 5 && (
          <div className="max-w-7xl mx-auto p-6 md:p-12 animate-in zoom-in-95 duration-700">
            <div className="flex flex-col xl:flex-row gap-12 items-start justify-center">
              <div className="w-full max-w-2xl">
                <div className="glass p-5 rounded-[4rem] shadow-2xl relative border-white/10">
                  <div className={`overflow-hidden rounded-[3rem] transition-all duration-700 ${state.isGenerating ? 'opacity-20 blur-3xl scale-95' : 'opacity-100'}`}>
                    {state.resultImage ? (
                        <img src={state.resultImage} className="w-full h-auto shadow-2xl bg-black" />
                    ) : (
                        <div className="aspect-[9/16] bg-black flex items-center justify-center text-slate-500 font-black">GERANDO...</div>
                    )}
                  </div>
                  {state.isGenerating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-8 shadow-[0_0_40px_rgba(37,99,235,0.3)]"></div>
                        <p className="text-sm font-black uppercase tracking-[0.4em] text-blue-500 animate-pulse">{state.statusMessage}</p>
                    </div>
                  )}
                </div>
                <div className="mt-8 flex gap-4">
                    <button onClick={() => { if(!state.resultImage) return; const a = document.createElement('a'); a.href = state.resultImage; a.download = `criativo_clone_${Date.now()}.png`; a.click(); }} className="flex-1 bg-blue-600 py-6 rounded-2xl font-black text-xs uppercase shadow-xl hover:-translate-y-1 transition-all active:scale-95"><i className="fa-solid fa-download mr-2"></i> Download 4K</button>
                    <button onClick={() => setState(prev => ({ ...prev, currentStep: 4, resultImage: null }))} className="px-10 py-6 glass rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">Ajustar Edição</button>
                </div>
              </div>

              <div className="w-full xl:w-96 space-y-8">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-500 mb-8 flex items-center gap-2"><i className="fa-solid fa-code-branch"></i> Gerar Outras Versões</h3>
                <div className="space-y-4">
                    {state.copyOptions.map((opt, i) => (
                        <button key={i} disabled={state.isGenerating} onClick={() => handleGenerateVariation(opt)} className={`w-full text-left glass p-6 rounded-[2.5rem] border transition-all ${state.copy.header1 === opt.header1 ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(37,99,235,0.1)]' : 'border-white/5 opacity-40 hover:opacity-100 hover:border-blue-500/30'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[7px] font-black uppercase opacity-40">Variação {i+1}</span>
                                {state.copy.header1 === opt.header1 && <i className="fa-solid fa-circle-check text-blue-500 text-[10px]"></i>}
                            </div>
                            <h4 className="text-sm font-black text-white line-clamp-1 mb-1">{opt.header1}</h4>
                            <p className="text-[10px] text-slate-500 line-clamp-2 italic leading-tight">{opt.strategy}</p>
                        </button>
                    ))}
                </div>
                <div className="pt-8 border-t border-white/5 text-center">
                    <button onClick={resetProject} className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 hover:text-red-500 transition-all group active:scale-90">
                        <i className="fa-solid fa-rotate-right mr-2 group-hover:rotate-180 transition-transform"></i> Novo Projeto Master
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.error && <div className="mt-8 p-6 mx-auto max-w-xl bg-red-600/10 border border-red-500/30 text-red-500 rounded-2xl text-center font-black animate-in shake text-sm flex items-center justify-center gap-3"><i className="fa-solid fa-bug"></i> {state.error}</div>}
      </main>

      <footer className="py-8 px-6 text-center border-t border-white/5 opacity-20">
        <p className="text-[9px] font-black uppercase tracking-[0.4em]">Clone Master Lab &copy; 2025 | Developed by Tata Gonçalves</p>
      </footer>

      {state.isAnalyzing && (
        <div className="fixed inset-0 z-[100] bg-[#020617]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6">
          <div className="relative w-32 h-32 mb-10">
            <div className="absolute inset-0 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-4 border-4 border-blue-600/10 border-b-blue-600 rounded-full animate-spin-slow"></div>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Engenharia Master...</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500 animate-pulse">{state.statusMessage}</p>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
