import React, { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  ChevronRight,
  GitBranch,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Search,
  ArrowUp,
  Code2,
  File,
  Eye,
  Download,
  BookOpen,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';
import type {
  GitRepositoryConnectionItem,
  GitBranchSummary,
  GitTreeItem,
  GitFileContent,
} from '../../types/git';

export interface GitCodeBrowserViewProps {
  projectId: number;
  initialRepoId?: number;
  initialPath?: string;
}

// Maps file extensions to Monaco Editor languages
function getMonacoLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'py':
      return 'python';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'sql':
      return 'sql';
    case 'java':
      return 'java';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
      return 'cpp';
    case 'xml':
    case 'svg':
      return 'xml';
    default:
      return 'plaintext';
  }
}

// Renders appropriate icon for file extension
function renderFileIcon(name: string, type: 'file' | 'dir') {
  if (type === 'dir') {
    return <Folder size={15} className="text-amber-400 shrink-0" />;
  }

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode size={15} className="text-blue-400 shrink-0" />;
    case 'js':
    case 'jsx':
      return <FileCode size={15} className="text-amber-300 shrink-0" />;
    case 'json':
      return <FileJson size={15} className="text-emerald-400 shrink-0" />;
    case 'md':
      return <BookOpen size={15} className="text-purple-400 shrink-0" />;
    case 'css':
    case 'scss':
      return <FileCode size={15} className="text-sky-400 shrink-0" />;
    case 'html':
      return <FileCode size={15} className="text-orange-400 shrink-0" />;
    case 'py':
      return <FileCode size={15} className="text-emerald-400 shrink-0" />;
    default:
      return <FileText size={15} className="text-zinc-400 shrink-0" />;
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const GitCodeBrowserView: React.FC<GitCodeBrowserViewProps> = ({
  projectId,
  initialRepoId,
  initialPath = '',
}) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();

  const [repositories, setRepositories] = useState<GitRepositoryConnectionItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(initialRepoId || null);
  const [branches, setBranches] = useState<GitBranchSummary[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Navigation path: current directory path
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [treeItems, setTreeItems] = useState<GitTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  // Selected file for viewing
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<GitFileContent | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  // Optional README in directory
  const [readmeContent, setReadmeContent] = useState<GitFileContent | null>(null);

  // Search filter for files in current tree
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedClone, setCopiedClone] = useState(false);
  const [rawViewMode, setRawViewMode] = useState(false);

  // 1. Fetch repositories
  useEffect(() => {
    let isMounted = true;
    const fetchRepos = async () => {
      try {
        const res = await gitService.getRepositories(projectId);
        if (isMounted && res.success && res.data && res.data.length > 0) {
          setRepositories(res.data);
          if (!selectedRepoId) {
            setSelectedRepoId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchRepos();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // 2. Fetch branches for selected repo
  useEffect(() => {
    if (!selectedRepoId) return;

    let isMounted = true;
    const fetchBranches = async () => {
      try {
        const res = await gitService.getBranches(projectId, selectedRepoId);
        if (isMounted && res.success && res.data) {
          setBranches(res.data);
          const defaultB = res.data.find((b) => b.isDefault)?.name || res.data[0]?.name || 'main';
          setSelectedBranch(defaultB);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedRepoId]);

  // 3. Fetch directory tree whenever currentPath, repo, or branch changes
  useEffect(() => {
    if (!selectedRepoId) return;

    let isMounted = true;
    const fetchTree = async () => {
      try {
        setLoadingTree(true);
        const res = await gitService.getTree(projectId, selectedRepoId, currentPath, selectedBranch || undefined);
        if (isMounted && res.success && res.data) {
          setTreeItems(res.data);

          // Check if README.md exists in current tree to auto-load preview
          const readme = res.data.find((item) => item.name.toLowerCase() === 'readme.md');
          if (readme && !selectedFilePath) {
            gitService.getFileContent(projectId, selectedRepoId, readme.path, selectedBranch || undefined)
              .then((rRes) => {
                if (isMounted && rRes.success && rRes.data) setReadmeContent(rRes.data);
              })
              .catch(() => {});
          } else {
            setReadmeContent(null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingTree(false);
      }
    };
    fetchTree();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedRepoId, currentPath, selectedBranch]);

  // 4. Fetch file content when selectedFilePath changes
  useEffect(() => {
    if (!selectedRepoId || !selectedFilePath) {
      setFileContent(null);
      return;
    }

    let isMounted = true;
    const fetchContent = async () => {
      try {
        setLoadingFile(true);
        const res = await gitService.getFileContent(projectId, selectedRepoId, selectedFilePath, selectedBranch || undefined);
        if (isMounted && res.success && res.data) {
          setFileContent(res.data);
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not load file content');
      } finally {
        if (isMounted) setLoadingFile(false);
      }
    };
    fetchContent();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedRepoId, selectedFilePath, selectedBranch]);

  // Breadcrumbs calculation
  const breadcrumbs = useMemo(() => {
    const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];
    const crumbs = [{ label: selectedRepo?.fullName || 'root', path: '' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      crumbs.push({ label: part, path: accumulated });
    }
    return crumbs;
  }, [currentPath, selectedRepoId, repositories]);

  const selectedRepo = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId) || repositories[0];
  }, [repositories, selectedRepoId]);

  // Handle clicking a tree item
  const handleItemClick = (item: GitTreeItem) => {
    if (item.type === 'dir') {
      setCurrentPath(item.path);
      setSelectedFilePath(null);
      setFileContent(null);
    } else {
      setSelectedFilePath(item.path);
    }
  };

  // Navigate to parent directory
  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedFilePath(null);
    setFileContent(null);
  };

  const handleCopyCode = async () => {
    if (!fileContent?.content) return;
    await navigator.clipboard.writeText(fileContent.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success('Copied to clipboard', 'File code copied');
  };

  const handleCopyClone = async () => {
    const url = selectedRepo?.cloneUrl || selectedRepo?.webUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedClone(true);
    setTimeout(() => setCopiedClone(false), 2000);
    toast.success('Copied clone URL', url);
  };

  // Filtered tree items by query
  const filteredTree = useMemo(() => {
    if (!filterQuery.trim()) return treeItems;
    const q = filterQuery.toLowerCase();
    return treeItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [treeItems, filterQuery]);

  return (
    <div className="space-y-4 text-left">
      {/* ─── Top Navigation & Action Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0E0F14] border border-[#27272A] shadow-sm">
        {/* Repo Picker, Branch Picker, and Path Breadcrumbs */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          {/* Repo selector if multiple */}
          {repositories.length > 1 && (
            <select
              value={selectedRepoId || ''}
              onChange={(e) => {
                setSelectedRepoId(Number(e.target.value));
                setCurrentPath('');
                setSelectedFilePath(null);
              }}
              className="h-9 px-2.5 rounded-xl bg-[#111216] border border-[#27272A] text-xs font-mono text-zinc-300 focus:outline-none"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

          {/* Branch Picker */}
          <div className="relative shrink-0">
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedFilePath(null);
              }}
              className="h-9 pl-7 pr-6 rounded-xl bg-[#111216] border border-[#27272A] text-xs font-mono text-indigo-300 focus:outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <GitBranch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>

          {/* Clickable Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 overflow-x-auto py-0.5">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1 && !selectedFilePath;
              return (
                <React.Fragment key={crumb.path}>
                  {idx > 0 && <span className="text-zinc-600">/</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPath(crumb.path);
                      setSelectedFilePath(null);
                    }}
                    className={cn(
                      'hover:text-white transition-colors cursor-pointer truncate max-w-[140px]',
                      isLast ? 'text-white font-semibold' : 'text-zinc-400'
                    )}
                  >
                    {crumb.label}
                  </button>
                </React.Fragment>
              );
            })}

            {/* If a file is selected, show it at the end */}
            {selectedFilePath && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-indigo-300 font-bold truncate">
                  {selectedFilePath.split('/').pop()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {selectedRepo?.webUrl && (
            <a
              href={selectedRepo.webUrl}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-700/60"
              title="Open repository on GitHub / GitLab"
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">Open in Git</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleCopyClone}
            className="h-8 px-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
            title="Copy Clone URL"
          >
            {copiedClone ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="hidden sm:inline">{copiedClone ? 'Copied' : 'Clone URL'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2-Column Explorer & Monaco Editor Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Explorer (3 or 4 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 rounded-2xl bg-[#0E0F14] border border-[#27272A] p-3.5 space-y-3 shadow-md">
          {/* Explorer Header & Search Filter */}
          <div className="flex items-center justify-between pb-2 border-b border-[#27272A]/80">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 tracking-tight">
              <Code2 size={14} style={{ color: accentColor }} />
              <span>Repository Files</span>
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              {filteredTree.length} items
            </span>
          </div>

          {/* Search bar inside tree */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter folder items..."
              className="w-full h-8 pl-8 pr-2 text-xs bg-[#111216] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          {/* Directory Items List */}
          <div className="space-y-0.5 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {/* Go Up button if inside a subfolder */}
            {currentPath && (
              <button
                type="button"
                onClick={handleNavigateUp}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer text-left"
              >
                <ArrowUp size={14} className="text-zinc-500 shrink-0" />
                <span className="font-mono">..</span>
              </button>
            )}

            {loadingTree ? (
              <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-zinc-400" />
                <span>Loading directory...</span>
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No files found matching "{filterQuery}"
              </div>
            ) : (
              filteredTree.map((item) => {
                const isSelected = selectedFilePath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer text-left group',
                      isSelected
                        ? 'bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/30'
                        : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {renderFileIcon(item.name, item.type)}
                      <span className="font-mono text-xs truncate">{item.name}</span>
                    </div>

                    {item.type === 'dir' ? (
                      <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                    ) : (
                      item.size !== undefined && (
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {formatBytes(item.size)}
                        </span>
                      )
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Monaco Editor / Directory View (8 or 9 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 rounded-2xl bg-[#0E0F14] border border-[#27272A] overflow-hidden shadow-xl flex flex-col min-h-[640px]">
          {selectedFilePath ? (
            /* ─── FILE VIEW: MONACO EDITOR (VS Code Engine) ─── */
            <div className="flex flex-col flex-1 h-full">
              {/* File Header Bar */}
              <div className="flex items-center justify-between p-3 px-4 border-b border-[#27272A] bg-[#121319]">
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderFileIcon(selectedFilePath, 'file')}
                  <span className="font-mono text-xs font-bold text-white truncate">
                    {selectedFilePath.split('/').pop()}
                  </span>
                  {fileContent && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                      {getMonacoLanguage(selectedFilePath)}
                    </span>
                  )}
                  {fileContent?.size !== undefined && (
                    <span className="text-[11px] text-zinc-500 font-mono shrink-0">
                      {formatBytes(fileContent.size)}
                    </span>
                  )}
                </div>

                {/* Right controls: Raw view toggle & Copy Code */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRawViewMode(!rawViewMode)}
                    className={cn(
                      'h-7 px-2.5 rounded-lg text-xs font-mono font-medium transition-colors border',
                      rawViewMode
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                    )}
                  >
                    Raw
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="h-7 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700"
                    title="Copy File Content"
                  >
                    {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Editor Container */}
              <div className="flex-1 relative min-h-[560px] bg-[#1e1e1e]">
                {loadingFile ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400 bg-[#0E0F14]">
                    <Loader2 size={24} className="animate-spin text-zinc-300" />
                    <span>Loading file content from git provider...</span>
                  </div>
                ) : rawViewMode ? (
                  <pre className="p-4 text-xs font-mono text-zinc-300 whitespace-pre-wrap break-words overflow-auto h-[560px]">
                    {fileContent?.content || '// Empty file'}
                  </pre>
                ) : (
                  <Editor
                    height="560px"
                    theme="vs-dark"
                    language={getMonacoLanguage(selectedFilePath)}
                    value={fileContent?.content || ''}
                    options={{
                      readOnly: true,
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      lineNumbers: 'on',
                      folding: true,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'on',
                      fontFamily: "'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
                    }}
                  />
                )}
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between p-2 px-4 border-t border-[#27272A] bg-[#121319] text-[11px] text-zinc-500 font-mono">
                <div className="flex items-center gap-3">
                  <span>UTF-8</span>
                  <span>•</span>
                  <span>{fileContent?.content ? fileContent.content.split('\n').length : 0} lines</span>
                </div>
                <span>Monaco Editor (VS Code Engine)</span>
              </div>
            </div>
          ) : (
            /* ─── DIRECTORY LEVEL VIEW (GitHub Style) ─── */
            <div className="flex flex-col flex-1 p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <FolderOpen size={16} className="text-amber-400" />
                    <span>{currentPath ? currentPath : selectedRepo?.fullName || 'Repository Root'}</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Select any file to preview syntax-highlighted code in Monaco Editor.
                  </p>
                </div>
              </div>

              {/* Directory Content Table */}
              <div className="rounded-xl border border-[#27272A] overflow-hidden bg-[#111216]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14151C] text-zinc-400 border-b border-[#27272A] font-mono text-[11px]">
                    <tr>
                      <th className="p-3 pl-4">Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 pr-4 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A]/70">
                    {treeItems.map((item) => (
                      <tr
                        key={item.path}
                        onClick={() => handleItemClick(item)}
                        className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                      >
                        <td className="p-2.5 pl-4 flex items-center gap-2.5">
                          {renderFileIcon(item.name, item.type)}
                          <span className="font-mono text-zinc-200 group-hover:text-white group-hover:underline">
                            {item.name}
                          </span>
                        </td>
                        <td className="p-2.5 text-zinc-500 uppercase font-mono text-[10px]">
                          {item.type === 'dir' ? 'Folder' : 'File'}
                        </td>
                        <td className="p-2.5 pr-4 text-right font-mono text-zinc-500">
                          {item.type === 'file' ? formatBytes(item.size) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* README Preview box if README.md exists */}
              {readmeContent && (
                <div className="rounded-xl border border-[#27272A] bg-[#111216] overflow-hidden text-left mt-4 shadow-sm">
                  <div className="flex items-center gap-2 p-3 px-4 bg-[#14151C] border-b border-[#27272A] text-xs font-semibold text-white">
                    <BookOpen size={14} className="text-purple-400" />
                    <span>README.md</span>
                  </div>
                  <div className="p-5 text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                    {readmeContent.content}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

