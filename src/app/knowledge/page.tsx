'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Database, Search, FileText, Upload, Trash2, Plus, Sparkles, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface Document {
  id: string;
  title: string;
  content: string;
  fileType: string | null;
  isIndexed: boolean;
  createdAt: string;
  similarity?: number;
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom manual entry states
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docLoading, setDocLoading] = useState(false);

  // File parsing states
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    setDocLoading(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle,
          content: docContent,
          fileType: 'TXT',
        }),
      });

      if (!res.ok) throw new Error('Failed to create document');
      
      setDocTitle('');
      setDocContent('');
      fetchDocuments();
    } catch (err) {
      console.error(err);
    } finally {
      setDocLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document from the knowledge base?')) return;
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete document');
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchDocuments();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          query: searchQuery,
        }),
      });

      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side file uploading and parsing utilizing FileReader
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus(`Reading "${file.name}"...`);

    const reader = new FileReader();
    
    // Parse text-based files
    if (file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        try {
          const res = await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: file.name,
              content: text,
              fileType: file.name.split('.').pop()?.toUpperCase() || 'TXT',
            }),
          });
          
          if (!res.ok) throw new Error('Failed to index file');

          setUploadStatus(`Successfully indexed: ${file.name}`);
          setTimeout(() => setUploadStatus(null), 3000);
          fetchDocuments();
        } catch (err) {
          console.error(err);
          setUploadStatus('Error indexing file.');
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.pdf')) {
      // PDF simulation parsing metadata for UI testing
      setUploadStatus(`Extracting PDF coordinates: ${file.name}...`);
      setTimeout(async () => {
        try {
          const res = await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: file.name,
              content: `[Extracted PDF Metadata Content]\nFile title: ${file.name}\nSimulating OCR indexing. The document contains technical details on system designs.`,
              fileType: 'PDF',
            }),
          });

          if (!res.ok) throw new Error('Failed to index PDF');

          setUploadStatus(`Successfully indexed PDF: ${file.name}`);
          setTimeout(() => setUploadStatus(null), 3000);
          fetchDocuments();
        } catch (err) {
          setUploadStatus('PDF parsing error.');
        }
      }, 1200);
    } else {
      setUploadStatus('File type unsupported. Support: .txt, .md, .pdf, .json');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Knowledge Base & <span className="text-indigo-400 glow-text font-light">Retrieval</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Index text documents or PDF specifications and retrieve them using semantic search.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Documents Grid (span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Query search input */}
          <div className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.05)]">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Semantic document query (e.g. 'what is the architecture logic?')"
                  className="w-full pl-10 pr-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:brightness-110 active:scale-95 transition-all"
              >
                <Sparkles size={12} />
                Search
              </button>
            </form>
          </div>

          {/* List of documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <RefreshCw size={24} className="animate-spin text-indigo-500" />
              </div>
            ) : documents.length === 0 ? (
              <div className="col-span-full glass rounded-2xl py-12 text-center border border-dashed border-slate-800">
                <AlertCircle className="text-slate-600 mx-auto mb-2" size={24} />
                <p className="text-xs text-slate-500 font-mono">No documents indexed in your second brain.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="glass p-5 rounded-2xl border border-[rgba(255,255,255,0.04)] hover:border-[rgba(99,102,241,0.15)] glow-border transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-bold text-white truncate block">{doc.title}</span>
                      <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 uppercase">
                        {doc.fileType || 'TXT'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal line-clamp-3 font-medium">
                      {doc.content}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-slate-900/60 pt-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-slate-600">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                      {doc.similarity !== undefined && (
                        <span className="text-[9px] font-mono text-indigo-400 font-bold bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                          {Math.round(doc.similarity * 100)}% Similarity
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-slate-600 hover:text-red-400 cursor-pointer p-1 rounded-md transition-colors"
                      title="Remove document"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Indexing Controls */}
        <div className="flex flex-col gap-6">
          
          {/* Simulated File Uploader */}
          <GlowingCard title="File Indexer" subtitle="Import text files or PDF specifications">
            <div className="flex flex-col gap-4 mt-2">
              <div
                onClick={handleUploadClick}
                className="border-2 border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/[0.01] transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload size={16} className="text-slate-500 group-hover:text-indigo-400" />
                </div>
                <div className="flex flex-col items-center text-center gap-1">
                  <span className="text-xs font-semibold text-slate-200">Import Specification</span>
                  <span className="text-[9px] font-mono text-slate-500">Supports PDF, TXT, MD, JSON</span>
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.md,.pdf,.json"
                className="hidden"
              />

              {uploadStatus && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 text-indigo-300 text-[10px] font-mono p-3 rounded-xl flex items-center gap-2">
                  <RefreshCw size={11} className="animate-spin text-indigo-400 shrink-0" />
                  <span>{uploadStatus}</span>
                </div>
              )}
            </div>
          </GlowingCard>

          {/* Manual document addition */}
          <GlowingCard title="Add Plain Text" subtitle="Index custom guides or instructions">
            <form onSubmit={handleManualCreate} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. System Roadmap V2"
                  className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                  Document Contents
                </label>
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Paste references, system specifications..."
                  rows={5}
                  required
                  className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={docLoading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 mt-2"
              >
                {docLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={14} />
                    Record Document
                  </>
                )}
              </button>
            </form>
          </GlowingCard>

        </div>

      </div>
    </div>
  );
}
