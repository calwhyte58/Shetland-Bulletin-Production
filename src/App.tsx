import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, isValid, addDays, getWeek, startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';
import { Plus, Download, History, LayoutDashboard, Trash2, FileDown, Printer, Upload, Calendar, Check, Pencil, RotateCcw, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DSPLegend, 
  DinophysisLegend, 
  PSPLegend, 
  AlexandriumLegend, 
  ASPLegend, 
  PseudoNitzschiaLegend, 
  AZALegend, 
  YTXLegend,
  SSTLegend,
  SSCLegend,
  KareniaLegend,
  ChlorophyllLegend
} from '@/src/components/Legends';
import { WeeklyReport, BulletinType } from '@/src/types';
import { getWeekInfo, formatBulletinDateRange, formatShortDateRange, compressImage } from '@/src/lib/bulletin-utils';
import html2canvas from 'html2canvas';
import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { get, set, del } from 'idb-keyval';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number | string;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, onChange, className = '', minHeight = '38px', style, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const handleRef = (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && typeof ref === 'object') {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      }
    };

    const adjustHeight = () => {
      const textarea = internalRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        const targetMin = typeof minHeight === 'number' ? minHeight : parseInt(String(minHeight), 10) || 38;
        textarea.style.height = `${Math.max(textarea.scrollHeight, targetMin)}px`;
      }
    };

    useEffect(() => {
      adjustHeight();
    }, [value]);

    return (
      <textarea
        ref={handleRef}
        value={value}
        onChange={(e) => {
          onChange?.(e);
          adjustHeight();
        }}
        className={`w-full p-2.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all overflow-hidden resize-none ${className}`}
        style={{ minHeight, ...style }}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export const DEFAULT_ANALYSIS_TEXT = {
  biotoxinReport: 'All classified harvesting zones remain within safe statutory limits. Routine liquid chromatography testing confirms that OA, DTX, PTX, AZA, and YTX levels remain well below regulatory maximum permitted concentrations. No harvesting closures are indicated.',
  biotoxins: {
    asp: 'Not detected (< 1.0 mg/kg) across all monitoring zones',
    aza: 'Trace concentrations detected in West Mainland (< 16 µg/kg), well below 160 µg/kg limit',
    dsp: 'Below regulatory limit of 160 µg/kg OA equiv. Maximum recorded 32 µg/kg in Clift Sound',
    psp: 'Below Limit of Quantification (LOQ) at all Shetland monitoring stations',
    ytx: 'Not detected (< 0.1 mg/kg YTX equivalents)'
  },
  harmfulAlgaeReport: 'Phytoplankton cell counts remain in typical baseline ranges. No cell count warnings or threshold breaches recorded for Alexandrium, Dinophysis, or Pseudo-nitzschia species. Water column stratification remains weak with low risk of bloom development.',
  harmfulAlgae: {
    alexandrium: '< 20 cells/L (Below threshold at all monitoring stations)',
    dinophysis: 'Present at low levels (max 40 cells/L in Vaila Sound, below 100 cells/L threshold)',
    karenia: 'Not detected in surface or integrated column samples',
    prorocentrum: '< 40 cells/L (Below threshold levels)',
    pseudoDelicatissima: 'Background densities (< 5,000 cells/L)',
    pseudoSeriata: '< 2,000 cells/L across all monitored voes'
  },
  trendsForecast: 'Overall low risk across all aquaculture and wild harvesting sites. Hydrographic conditions, tidal flushing, and offshore wind regimes suggest minimal advective risk of harmful algal transport into coastal voes over the upcoming week.',
  trends: {
    alexandriumPsp: 'Water temperatures remain below optimal bloom initiation thresholds (current SST 8.2°C). Low risk of PSP events expected for the coming fortnight.',
    dinophysisDsp: 'Low cell densities persist offshore. Recent wind patterns indicate minimal onshore transport. Risk remains low to moderate in sheltered southwest voes.',
    pseudoNitzschiaAsp: 'Diatom populations dominated by non-toxic species. Pseudo-nitzschia numbers well below the 50,000 cells/L action threshold.',
    azaYtx: 'Azadinium and Protoceratium cell concentrations remain negligible. Historical trends suggest low probability of toxic events in early spring.',
    riskPsp: 'Low',
    riskDsp: 'Low to Moderate',
    riskAsp: 'Low',
    riskYtx: 'Low',
    riskAza: 'Low'
  }
};

export default function App() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [activeTab, setActiveTab] = useState('bulletin');
  const [bulletinType, setBulletinType] = useState<BulletinType>(BulletinType.DSP);
  const [editingReport, setEditingReport] = useState<WeeklyReport | null>(null);

  // In-memory draft for Analysis report text, saved across tab switches and browser sessions
  const [analysisDraft, setAnalysisDraft] = useState(() => {
    try {
      const saved = localStorage.getItem('shetland_analysis_memory_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          biotoxinReport: parsed.biotoxinReport ?? DEFAULT_ANALYSIS_TEXT.biotoxinReport,
          biotoxins: { ...DEFAULT_ANALYSIS_TEXT.biotoxins, ...(parsed.biotoxins || {}) },
          harmfulAlgaeReport: parsed.harmfulAlgaeReport ?? DEFAULT_ANALYSIS_TEXT.harmfulAlgaeReport,
          harmfulAlgae: { ...DEFAULT_ANALYSIS_TEXT.harmfulAlgae, ...(parsed.harmfulAlgae || {}) },
          trendsForecast: parsed.trendsForecast ?? DEFAULT_ANALYSIS_TEXT.trendsForecast,
          trends: { ...DEFAULT_ANALYSIS_TEXT.trends, ...(parsed.trends || {}) }
        };
      }
    } catch (e) {
      console.warn('Failed to parse saved analysis draft', e);
    }
    return DEFAULT_ANALYSIS_TEXT;
  });

  // Sync memory draft to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('shetland_analysis_memory_draft', JSON.stringify(analysisDraft));
    } catch (e) {
      console.warn('Failed to save analysis draft to localStorage', e);
    }
  }, [analysisDraft]);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    manualWeekNumber: '' as string | number,
    manualDateRange: '',
    toxinMap: '',
    phytoMap: '',
    additionalMaps: Array(15).fill(''),
    mapDates: Array(15).fill(''),
    forecastDates: [
      format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      format(addDays(new Date(), 2), 'yyyy-MM-dd'),
      format(addDays(new Date(), 3), 'yyyy-MM-dd')
    ],
    biotoxinReport: analysisDraft.biotoxinReport,
    biotoxins: { ...analysisDraft.biotoxins },
    harmfulAlgaeReport: analysisDraft.harmfulAlgaeReport,
    harmfulAlgae: { ...analysisDraft.harmfulAlgae },
    trendsForecast: analysisDraft.trendsForecast,
    trends: { ...analysisDraft.trends },
    commentary: '',
    kareniaStatus: '',
    predictionRisk: '',
    predictionWhy: '',
    windRoseMonth: '',
  });
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const bulletinRef = useRef<HTMLDivElement>(null);

  const bulletinConfig = {
    [BulletinType.DSP]: {
      title: 'Diarrhetic shellfish poisoning toxins & causative phytoplankton',
      topLegend: DSPLegend,
      bottomLegend: DinophysisLegend,
      topLabel: 'OA/DTXs/PTXs',
      bottomLabel: 'Dinophysis Sp.'
    },
    [BulletinType.PSP]: {
      title: 'Paralytic shellfish poisoning toxins & causative phytoplankton',
      topLegend: PSPLegend,
      bottomLegend: AlexandriumLegend,
      topLabel: 'PSP',
      bottomLabel: 'Alexandrium Sp.'
    },
    [BulletinType.ASP]: {
      title: 'Amnesic Shellfish Poisoning & causative phytoplankton',
      topLegend: ASPLegend,
      bottomLegend: PseudoNitzschiaLegend,
      topLabel: 'ASP',
      bottomLabel: 'Pseudo-nitzschia Sp.'
    },
    [BulletinType.AZA_YTX]: {
      title: 'Azaspiracid & Yessotoxin shellfish poisoning toxins',
      topLegend: AZALegend,
      bottomLegend: YTXLegend,
      topLabel: 'AZAs',
      bottomLabel: 'YTXs'
    },
    [BulletinType.SST]: {
      title: 'Sea Surface temperature (°C) in preceding 6 days in the Shetland Islands',
      legend: SSTLegend,
      footer: 'Maps provided courtesy of the Jet Propulsion Laboratory, NASA'
    },
    [BulletinType.SSC]: {
      title: 'Forecasted Sea Surface currents',
      legend: SSCLegend,
      footer: 'Forecast provided by the model-NEATL-PHY-1/36°-AF-D-PGS (IBI36QV4R1-PGS) courtesy of Mercator.'
    },
    [BulletinType.KARENIA]: {
      title: 'Karenia mikimotoi',
      legend: KareniaLegend,
      topLabel: 'Karenia History Map',
      bottomLabel: 'Phytoplankton Gallery'
    },
    [BulletinType.CHLOROPHYLL]: {
      title: 'Chlorophyll concentrations (mg/m³)',
      legend: ChlorophyllLegend,
      footer: 'Images provided by the Ocean Colour atl-chl-L-L4 NRT-Observations-Copernicus'
    },
    [BulletinType.WIND_ROSE]: {
      title: 'Mean wind direction observed in Shetland for current and three preceding weeks',
      topLabel: 'Week 13 Wind Rose',
      bottomLabel: 'Week 14 Wind Rose',
      footer: 'Data source: weather station at Sumburgh'
    },
    [BulletinType.SUMMARY]: {
      title: 'Status of biotoxins & harmful algae present in Shetland',
      footer: 'RL- reporting limit; LOQ – Limit of quantification',
      topLabel: 'Alexandrium Gauge',
      bottomLabel: 'Dinophysis Gauge'
    },
    [BulletinType.FORECAST]: {
      title: 'Wind and rain forecast for next three days in Shetland',
      footer: 'Forecast data derived from meteorological models',
      topLabel: '6 AM Map (Row 1)',
      bottomLabel: '12 Noon Map (Row 1)'
    },
    [BulletinType.ANALYSIS]: {
      title: 'Shetland Bulletin on the status of harmful & toxic algae',
      footer: 'While this bulletin is based on our expert opinion, SAMS cannot accept responsibility for harvesting or husbandry decisions. These remain the responsibility of the industry'
    }
  };

  const resetForm = (keepAnalysisDraft = true) => {
    setFormData(prev => ({
      date: format(new Date(), 'yyyy-MM-dd'),
      manualWeekNumber: '',
      manualDateRange: '',
      toxinMap: '',
      phytoMap: '',
      additionalMaps: Array(15).fill(''),
      mapDates: Array(15).fill(''),
      forecastDates: [
        format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        format(addDays(new Date(), 2), 'yyyy-MM-dd'),
        format(addDays(new Date(), 3), 'yyyy-MM-dd')
      ],
      biotoxinReport: keepAnalysisDraft ? analysisDraft.biotoxinReport : '',
      biotoxins: keepAnalysisDraft ? { ...analysisDraft.biotoxins } : { asp: '', aza: '', dsp: '', psp: '', ytx: '' },
      harmfulAlgaeReport: keepAnalysisDraft ? analysisDraft.harmfulAlgaeReport : '',
      harmfulAlgae: keepAnalysisDraft ? { ...analysisDraft.harmfulAlgae } : { alexandrium: '', dinophysis: '', karenia: '', prorocentrum: '', pseudoDelicatissima: '', pseudoSeriata: '' },
      trendsForecast: keepAnalysisDraft ? analysisDraft.trendsForecast : '',
      trends: keepAnalysisDraft ? { ...analysisDraft.trends } : {
        alexandriumPsp: '',
        dinophysisDsp: '',
        pseudoNitzschiaAsp: '',
        azaYtx: '',
        riskPsp: '',
        riskDsp: '',
        riskAsp: '',
        riskYtx: '',
        riskAza: ''
      },
      commentary: '',
      kareniaStatus: '',
      predictionRisk: '',
      predictionWhy: '',
      windRoseMonth: '',
    }));
  };

  // Keep memory draft synchronized whenever analysis text is written or edited
  useEffect(() => {
    if (bulletinType === BulletinType.ANALYSIS) {
      const hasAny = 
        formData.biotoxinReport ||
        formData.harmfulAlgaeReport ||
        formData.trendsForecast ||
        formData.biotoxins?.asp ||
        formData.harmfulAlgae?.alexandrium ||
        formData.trends?.alexandriumPsp;

      if (hasAny) {
        setAnalysisDraft({
          biotoxinReport: formData.biotoxinReport || '',
          biotoxins: { ...formData.biotoxins },
          harmfulAlgaeReport: formData.harmfulAlgaeReport || '',
          harmfulAlgae: { ...formData.harmfulAlgae },
          trendsForecast: formData.trendsForecast || '',
          trends: { ...formData.trends }
        });
      }
    }
  }, [
    bulletinType,
    formData.biotoxinReport,
    formData.biotoxins,
    formData.harmfulAlgaeReport,
    formData.harmfulAlgae,
    formData.trendsForecast,
    formData.trends
  ]);

  // When changing bulletin type, ensure analysis text is kept in memory and not erased
  useEffect(() => {
    if (!editingReport) {
      if (bulletinType === BulletinType.ANALYSIS) {
        // Pre-fill with the latest analysis report if available, otherwise preserve in-memory draft
        const latestAnalysis = reports
          .filter(r => r.type === BulletinType.ANALYSIS)
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

        if (latestAnalysis) {
          setFormData(prev => ({
            ...prev,
            manualWeekNumber: latestAnalysis.manualWeekNumber ?? latestAnalysis.weekNumber ?? prev.manualWeekNumber,
            manualDateRange: latestAnalysis.manualDateRange || prev.manualDateRange,
            date: latestAnalysis.startDate ? format(parseISO(latestAnalysis.startDate), 'yyyy-MM-dd') : prev.date,
            biotoxinReport: prev.biotoxinReport || latestAnalysis.biotoxinReport || analysisDraft.biotoxinReport,
            biotoxins: prev.biotoxins?.asp ? prev.biotoxins : (latestAnalysis.biotoxins || analysisDraft.biotoxins),
            harmfulAlgaeReport: prev.harmfulAlgaeReport || latestAnalysis.harmfulAlgaeReport || analysisDraft.harmfulAlgaeReport,
            harmfulAlgae: prev.harmfulAlgae?.alexandrium ? prev.harmfulAlgae : (latestAnalysis.harmfulAlgae || analysisDraft.harmfulAlgae),
            trendsForecast: prev.trendsForecast || latestAnalysis.trendsForecast || analysisDraft.trendsForecast,
            trends: prev.trends?.alexandriumPsp ? prev.trends : (latestAnalysis.trends || analysisDraft.trends)
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            biotoxinReport: prev.biotoxinReport || analysisDraft.biotoxinReport,
            biotoxins: prev.biotoxins?.asp ? prev.biotoxins : analysisDraft.biotoxins,
            harmfulAlgaeReport: prev.harmfulAlgaeReport || analysisDraft.harmfulAlgaeReport,
            harmfulAlgae: prev.harmfulAlgae?.alexandrium ? prev.harmfulAlgae : analysisDraft.harmfulAlgae,
            trendsForecast: prev.trendsForecast || analysisDraft.trendsForecast,
            trends: prev.trends?.alexandriumPsp ? prev.trends : analysisDraft.trends
          }));
        }
      } else {
        resetForm(true);
      }
    }
  }, [bulletinType]);

  const startEditingAnalysis = (targetSection?: 'biotoxin' | 'harmfulAlgae' | 'trends') => {
    // Determine the report to edit: currently viewed report, or latest analysis report
    const targetReport = (latestReport && latestReport.type === BulletinType.ANALYSIS)
      ? latestReport
      : reports.filter(r => r.type === BulletinType.ANALYSIS).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

    if (targetReport) {
      setEditingReport(targetReport);
      const parsedDate = targetReport.startDate ? parseISO(targetReport.startDate) : new Date();
      setFormData(prev => ({
        ...prev,
        date: isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        manualWeekNumber: targetReport.manualWeekNumber ?? targetReport.weekNumber ?? '',
        manualDateRange: targetReport.manualDateRange ?? '',
        biotoxinReport: targetReport.biotoxinReport ?? analysisDraft.biotoxinReport,
        biotoxins: targetReport.biotoxins ?? analysisDraft.biotoxins,
        harmfulAlgaeReport: targetReport.harmfulAlgaeReport ?? analysisDraft.harmfulAlgaeReport,
        harmfulAlgae: targetReport.harmfulAlgae ?? analysisDraft.harmfulAlgae,
        trendsForecast: targetReport.trendsForecast ?? analysisDraft.trendsForecast,
        trends: targetReport.trends ?? analysisDraft.trends,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        biotoxinReport: analysisDraft.biotoxinReport,
        biotoxins: analysisDraft.biotoxins,
        harmfulAlgaeReport: analysisDraft.harmfulAlgaeReport,
        harmfulAlgae: analysisDraft.harmfulAlgae,
        trendsForecast: analysisDraft.trendsForecast,
        trends: analysisDraft.trends,
      }));
    }

    setBulletinType(BulletinType.ANALYSIS);
    setActiveTab('admin');

    if (targetSection) {
      const sectionName = targetSection === 'biotoxin' ? 'Biotoxin report' : targetSection === 'harmfulAlgae' ? 'Harmful algae report' : 'Trends & Forecast';
      toast.info(`Editing Analysis report - jumped to ${sectionName}`);
      setTimeout(() => {
        const el = document.getElementById(`analysis-section-${targetSection}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } else {
      toast.info('Editing Analysis report text');
    }
  };

  // Load from database on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Try IndexedDB first
        let savedReports = await get<WeeklyReport[]>('shetland_reports_db');
        
        // Fallback to localStorage for legacy data migration
        if (!savedReports) {
          const legacy = localStorage.getItem('shetland_reports');
          if (legacy) {
            savedReports = JSON.parse(legacy);
            // Move legacy data to IDB
            await set('shetland_reports_db', savedReports);
            localStorage.removeItem('shetland_reports');
            console.log('Migrated legacy localStorage data to IndexedDB');
          }
        }

        if (savedReports) {
          const migrated = savedReports.map((r: any) => ({
            ...r,
            type: r.type || BulletinType.DSP,
            targetDate: r.targetDate || r.startDate
          }));
          setReports(migrated);
        }
      } catch (e) {
        console.error('Failed to load reports from storage', e);
      }
    }
    loadData();
  }, []);

  // Save to database on change
  useEffect(() => {
    // We always save the reports array, even if empty, so that deletions persist
    set('shetland_reports_db', reports).catch(e => {
      console.error('Failed to save to IndexedDB', e);
      // Only show error toast if it's a real failure, not just initial state
      if (reports.length > 0) {
        toast.error('Failed to save reports. Storage might be full.');
      }
    });
  }, [reports]);

  const addReport = (
    newReport: Omit<WeeklyReport, 'id' | 'createdAt'>,
    additionalWeeklyReports?: Omit<WeeklyReport, 'id' | 'createdAt'>[]
  ) => {
    const report: WeeklyReport = {
      ...newReport,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    const extraReports: WeeklyReport[] = (additionalWeeklyReports || []).map(r => ({
      ...r,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    
    setReports(prev => {
      let filtered = [...prev];
      const allToInsert = [report, ...extraReports];

      for (const item of allToInsert) {
        const getRepWeek = (r: WeeklyReport) => r.manualWeekNumber ?? r.weekNumber;
        const getRepYear = (r: WeeklyReport) => new Date(r.startDate).getFullYear();

        if (item.type === BulletinType.SST || item.type === BulletinType.SSC) {
          // Environmental reports are locked to the specific day
          filtered = filtered.filter(r => !(r.type === item.type && r.targetDate === item.targetDate));
        } else {
          // Toxin and Wind Rose reports check week number and year
          filtered = filtered.filter(r => !(
            r.type === item.type &&
            getRepWeek(r) === getRepWeek(item) &&
            getRepYear(r) === getRepYear(item)
          ));
        }
      }

      return [...filtered, ...allToInsert].sort((a, b) => {
        const timeDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (a.manualWeekNumber ?? a.weekNumber) - (b.manualWeekNumber ?? b.weekNumber);
      });
    });
    
    if (report.type === BulletinType.ANALYSIS) {
      setAnalysisDraft({
        biotoxinReport: report.biotoxinReport || '',
        biotoxins: report.biotoxins || { asp: '', aza: '', dsp: '', psp: '', ytx: '' },
        harmfulAlgaeReport: report.harmfulAlgaeReport || '',
        harmfulAlgae: report.harmfulAlgae || { alexandrium: '', dinophysis: '', karenia: '', prorocentrum: '', pseudoDelicatissima: '', pseudoSeriata: '' },
        trendsForecast: report.trendsForecast || '',
        trends: report.trends || {
          alexandriumPsp: '',
          dinophysisDsp: '',
          pseudoNitzschiaAsp: '',
          azaYtx: '',
          riskPsp: '',
          riskDsp: '',
          riskAsp: '',
          riskYtx: '',
          riskAza: ''
        }
      });
    }
    
    setSelectedReportId(report.id);
    resetForm(true);
    toast.success('Report and maps saved successfully');
    setActiveTab('bulletin');
  };

  const updateReport = (
    updatedReport: WeeklyReport,
    additionalWeeklyReports?: Omit<WeeklyReport, 'id' | 'createdAt'>[]
  ) => {
    const extraReports: WeeklyReport[] = (additionalWeeklyReports || []).map(r => ({
      ...r,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));

    setReports(prev => {
      let updatedList = prev.map(r => r.id === updatedReport.id ? updatedReport : r);

      for (const item of extraReports) {
        const getRepWeek = (r: WeeklyReport) => r.manualWeekNumber ?? r.weekNumber;
        const getRepYear = (r: WeeklyReport) => new Date(r.startDate).getFullYear();

        const existingIdx = updatedList.findIndex(r => 
          r.type === item.type &&
          getRepWeek(r) === getRepWeek(item) &&
          getRepYear(r) === getRepYear(item)
        );

        if (existingIdx >= 0) {
          updatedList[existingIdx] = {
            ...updatedList[existingIdx],
            toxinMapUrl: item.toxinMapUrl || updatedList[existingIdx].toxinMapUrl,
            phytoMapUrl: item.phytoMapUrl || updatedList[existingIdx].phytoMapUrl
          };
        } else {
          updatedList.push(item);
        }
      }

      return updatedList.sort((a, b) => {
        const timeDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (a.manualWeekNumber ?? a.weekNumber) - (b.manualWeekNumber ?? b.weekNumber);
      });
    });

    if (updatedReport.type === BulletinType.ANALYSIS) {
      setAnalysisDraft({
        biotoxinReport: updatedReport.biotoxinReport || '',
        biotoxins: updatedReport.biotoxins || { asp: '', aza: '', dsp: '', psp: '', ytx: '' },
        harmfulAlgaeReport: updatedReport.harmfulAlgaeReport || '',
        harmfulAlgae: updatedReport.harmfulAlgae || { alexandrium: '', dinophysis: '', karenia: '', prorocentrum: '', pseudoDelicatissima: '', pseudoSeriata: '' },
        trendsForecast: updatedReport.trendsForecast || '',
        trends: updatedReport.trends || {
          alexandriumPsp: '',
          dinophysisDsp: '',
          pseudoNitzschiaAsp: '',
          azaYtx: '',
          riskPsp: '',
          riskDsp: '',
          riskAsp: '',
          riskYtx: '',
          riskAza: ''
        }
      });
    }

    setSelectedReportId(updatedReport.id || null);
    setEditingReport(null);
    resetForm(true);
    toast.success('Report updated successfully');
    setActiveTab('bulletin');
  };

  const deleteReport = (id: string) => {
    // window.confirm can be blocked in some iframe environments
    // We'll perform the deletion directly and notify the user via toast
    setReports(prev => prev.filter(r => r.id !== id));
    toast.info('Report deleted permanently');
  };

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to delete ALL historical data? This cannot be undone.')) {
      setReports([]);
      localStorage.removeItem('shetland_reports');
      del('shetland_reports_db').catch(console.error);
      toast.info('All data cleared');
    }
  };

  const loadSampleData = () => {
    const types = Object.values(BulletinType);
    const sampleReports: WeeklyReport[] = [];
    
    // Base Monday for week 12 (March 16, 2026)
    const baseWeek12Monday = new Date(2026, 2, 16);
    
    types.forEach(type => {
      [12, 13, 14, 15, 16].forEach(num => {
        const weekOffset = num - 12;
        const start = addWeeks(baseWeek12Monday, weekOffset);
        const end = addDays(start, 6);
        const startIso = format(start, "yyyy-MM-dd'T'00:00:00'Z'");
        const endIso = format(end, "yyyy-MM-dd'T'00:00:00'Z'");
        const isWindRose = type === BulletinType.WIND_ROSE;
        
        sampleReports.push({
          id: `sample-${type}-${num}`,
          type: type as BulletinType,
          weekNumber: num,
          startDate: startIso,
          endDate: endIso,
          targetDate: startIso,
          toxinMapUrl: `https://picsum.photos/seed/${type}-toxin-${num}/400/400`,
          phytoMapUrl: `https://picsum.photos/seed/${type}-phyto-${num}/400/400`,
          additionalMapUrls: Array.from({ length: 12 }).map((_, i) => 
            `https://picsum.photos/seed/${type}-add${i+1}-${num}/400/400`
          ),
          forecastDates: type === BulletinType.FORECAST ? [
            format(addDays(start, 1), 'yyyy-MM-dd'),
            format(addDays(start, 2), 'yyyy-MM-dd'),
            format(addDays(start, 3), 'yyyy-MM-dd')
          ] : undefined,
          biotoxinReport: type === BulletinType.ANALYSIS 
            ? 'All classified harvesting zones remain within safe statutory limits. Routine liquid chromatography testing confirms that OA, DTX, PTX, AZA, and YTX levels remain well below regulatory maximum permitted concentrations. No harvesting closures are indicated.' 
            : undefined,
          biotoxins: type === BulletinType.ANALYSIS ? {
            asp: 'Not detected (< 1.0 mg/kg) across all monitoring zones',
            aza: 'Trace concentrations detected in West Mainland (< 16 µg/kg), well below 160 µg/kg limit',
            dsp: 'Below regulatory limit of 160 µg/kg OA equiv. Maximum recorded 32 µg/kg in Clift Sound',
            psp: 'Below Limit of Quantification (LOQ) at all Shetland monitoring stations',
            ytx: 'Not detected (< 0.1 mg/kg YTX equivalents)'
          } : undefined,
          harmfulAlgaeReport: type === BulletinType.ANALYSIS
            ? 'Phytoplankton cell counts remain in typical baseline ranges. No cell count warnings or threshold breaches recorded for Alexandrium, Dinophysis, or Pseudo-nitzschia species. Water column stratification remains weak with low risk of bloom development.'
            : undefined,
          harmfulAlgae: type === BulletinType.ANALYSIS ? {
            alexandrium: '< 20 cells/L (Below threshold at all monitoring stations)',
            dinophysis: 'Present at low levels (max 40 cells/L in Vaila Sound, below 100 cells/L threshold)',
            karenia: 'Not detected in surface or integrated column samples',
            prorocentrum: '< 40 cells/L (Below threshold levels)',
            pseudoDelicatissima: 'Background densities (< 5,000 cells/L)',
            pseudoSeriata: '< 2,000 cells/L across all monitored voes'
          } : undefined,
          trendsForecast: type === BulletinType.ANALYSIS
            ? 'Overall low risk across all aquaculture and wild harvesting sites. Hydrographic conditions, tidal flushing, and offshore wind regimes suggest minimal advective risk of harmful algal transport into coastal voes over the upcoming week.'
            : undefined,
          trends: type === BulletinType.ANALYSIS ? {
            alexandriumPsp: 'Water temperatures remain below optimal bloom initiation thresholds (current SST 8.2°C). Low risk of PSP events expected for the coming fortnight.',
            dinophysisDsp: 'Low cell densities persist offshore. Recent wind patterns indicate minimal onshore transport. Risk remains low to moderate in sheltered southwest voes.',
            pseudoNitzschiaAsp: 'Diatom populations dominated by non-toxic species. Pseudo-nitzschia numbers well below the 50,000 cells/L action threshold.',
            azaYtx: 'Azadinium and Protoceratium cell concentrations remain negligible. Historical trends suggest low probability of toxic events in early spring.',
            riskPsp: 'Low',
            riskDsp: 'Low to Moderate',
            riskAsp: 'Low',
            riskYtx: 'Low',
            riskAza: 'Low'
          } : undefined,
          kareniaStatus: isWindRose ? 'Over the past week the average wind direction has been from the south east.' : 'Low levels of Karenia mikimotoi observed in most areas.',
          predictionRisk: isWindRose ? 'low' : undefined,
          predictionWhy: isWindRose ? 'During the summer Dinophysis can bloom out at sea and at shelf fronts found off the West of Shetland. Westerly winds can then blow these blooms into shore. Westerly winds may also retain Dinophysis cells in Westerly facing voes and in lets where their numbers may increase. Wind for the past week has been predominantly from the south east.' : undefined,
          windRoseMonth: isWindRose ? 'March' : undefined,
          commentary: isWindRose ? 'Mean wind direction and speed observed in Shetland over the past four weeks. Higher wind speeds are shown in lighter shades.' : undefined,
          createdAt: new Date().toISOString()
        });
      });
    });
    
    const sorted = sampleReports.sort((a, b) => b.weekNumber - a.weekNumber);
    setReports(sorted);
    const sampleAnalysis = sorted.find(r => r.type === BulletinType.ANALYSIS);
    if (sampleAnalysis) {
      setAnalysisDraft({
        biotoxinReport: sampleAnalysis.biotoxinReport || '',
        biotoxins: sampleAnalysis.biotoxins || DEFAULT_ANALYSIS_TEXT.biotoxins,
        harmfulAlgaeReport: sampleAnalysis.harmfulAlgaeReport || '',
        harmfulAlgae: sampleAnalysis.harmfulAlgae || DEFAULT_ANALYSIS_TEXT.harmfulAlgae,
        trendsForecast: sampleAnalysis.trendsForecast || '',
        trends: sampleAnalysis.trends || DEFAULT_ANALYSIS_TEXT.trends
      });
    }
    toast.success('Sample data loaded for all categories');
  };

  const exportToPDF = async () => {
    if (!bulletinRef.current) {
      toast.error('Bulletin content not found');
      return;
    }
    
    if (activeTab !== 'bulletin') {
      setActiveTab('bulletin');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const node = bulletinRef.current;
    if (!node) {
      toast.error('Bulletin content not found. Please switch to the Bulletin tab and try again.');
      return;
    }
    
    toast.promise(async () => {
      // Ensure images are fully loaded and have crossOrigin set safely for remote assets
      const images = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        images.map(img => {
          if (!img.crossOrigin && img.src.startsWith('http') && !img.src.startsWith(window.location.origin)) {
            img.crossOrigin = "anonymous";
          }
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve(null);
            img.onerror = () => resolve(null);
          });
        })
      );

      // Save original styles before high-res rendering
      const originalWidth = node.style.width;
      const originalMaxWidth = node.style.maxWidth;
      const originalHeight = node.style.height;
      const originalOverflow = node.style.overflow;

      try {
        // Enforce standard landscape layout width of 1122px while letting height expand naturally for full text visibility
        node.style.width = '1122px';
        node.style.maxWidth = '1122px';
        node.style.height = 'auto';
        node.style.overflow = 'visible';

        // Wait a short moment for DOM reflow
        await new Promise(resolve => setTimeout(resolve, 150));

        const scrollHeight = node.scrollHeight;
        const targetWidth = 1122;
        // Standard A4 landscape is 794px high, but expand smoothly if content/text is taller
        const targetHeight = Math.max(794, scrollHeight);

        let dataUrl = '';
        
        try {
          // Render at high resolution scale: 2.5 (2805 x 1985+ px, crisp 240+ DPI)
          const canvas = await html2canvas(node, {
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: targetWidth,
            height: targetHeight,
            windowWidth: 1122
          });
          dataUrl = canvas.toDataURL('image/png');
        } catch (h2cError) {
          console.warn('html2canvas capture failed, attempting high-resolution domtoimage fallback:', h2cError);
          const scale = 2.5;
          dataUrl = await domtoimage.toPng(node, {
            quality: 1.0,
            bgcolor: '#ffffff',
            width: targetWidth * scale,
            height: targetHeight * scale,
            style: {
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${targetWidth}px`,
              height: `${targetHeight}px`,
              overflow: 'visible'
            }
          });
        }

        const pdf = new jsPDF({
          orientation: targetHeight > targetWidth ? 'portrait' : 'landscape',
          unit: 'px',
          format: [targetWidth, targetHeight]
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, targetWidth, targetHeight, undefined, 'FAST');
        pdf.save(`Shetland_Bulletin_${bulletinType}_Week${latestReport?.manualWeekNumber || latestReport?.weekNumber || 'X'}.pdf`);
        
      } catch (err) {
        console.error('PDF Export Error:', err);
        throw err;
      } finally {
        // Restore original style
        node.style.width = originalWidth;
        node.style.maxWidth = originalMaxWidth;
        node.style.height = originalHeight;
        node.style.overflow = originalOverflow;
      }
    }, {
      loading: 'Generating high-resolution PDF (crisp print quality)...',
      success: 'High-resolution PDF downloaded successfully',
      error: (err) => `Export Failed: ${err.message || 'Check browser permissions'}`,
    });
  };

  // Get the latest 4 reports for the current type
  const displayReports = reports
    .filter(r => r.type === bulletinType)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.WIND_ROSE || bulletinType === BulletinType.SUMMARY || bulletinType === BulletinType.FORECAST || bulletinType === BulletinType.ANALYSIS ? -1 : -4);
  
  // Determine which report to show in the bulletin tab
  const latestReport = selectedReportId 
    ? reports.find(r => r.id === selectedReportId && r.type === bulletinType) || displayReports[displayReports.length - 1]
    : displayReports[displayReports.length - 1];

  // For standard 4-week toxin bulletins (DSP, PSP, ASP, AZA_YTX)
  const isToxinBulletin = bulletinType === BulletinType.DSP || bulletinType === BulletinType.PSP || bulletinType === BulletinType.ASP || bulletinType === BulletinType.AZA_YTX;

  const currentBulletinWeek = latestReport?.manualWeekNumber ?? latestReport?.weekNumber ?? getWeekInfo(new Date()).weekNumber;
  const currentBulletinDate = latestReport?.startDate && isValid(parseISO(latestReport.startDate)) 
    ? parseISO(latestReport.startDate) 
    : new Date();

  // Columns: index 0 (Week N-3), 1 (Week N-2), 2 (Week N-1), 3 (Week N - Current)
  const toxinTimelineColumns = [0, 1, 2, 3].map(colIdx => {
    const offset = 3 - colIdx; // 3, 2, 1, 0
    const weekNum = currentBulletinWeek - offset;
    const colStart = subWeeks(startOfWeek(currentBulletinDate, { weekStartsOn: 1 }), offset);
    const colEnd = endOfWeek(colStart, { weekStartsOn: 1 });
    const dateRangeLabel = formatShortDateRange(colStart.toISOString(), colEnd.toISOString());

    // Find if an exact matching report exists in reports for this week
    const matchingReport = reports.find(r => 
      r.type === bulletinType && 
      (r.manualWeekNumber ?? r.weekNumber) === weekNum
    );

    let toxinMap = '';
    let phytoMap = '';

    if (offset === 0) {
      toxinMap = latestReport?.toxinMapUrl || matchingReport?.toxinMapUrl || '';
      phytoMap = latestReport?.phytoMapUrl || matchingReport?.phytoMapUrl || '';
    } else if (offset === 1) {
      toxinMap = matchingReport?.toxinMapUrl || latestReport?.additionalMapUrls?.[0] || '';
      phytoMap = matchingReport?.phytoMapUrl || latestReport?.additionalMapUrls?.[1] || '';
    } else if (offset === 2) {
      toxinMap = matchingReport?.toxinMapUrl || latestReport?.additionalMapUrls?.[2] || '';
      phytoMap = matchingReport?.phytoMapUrl || latestReport?.additionalMapUrls?.[3] || '';
    } else if (offset === 3) {
      toxinMap = matchingReport?.toxinMapUrl || latestReport?.additionalMapUrls?.[4] || '';
      phytoMap = matchingReport?.phytoMapUrl || latestReport?.additionalMapUrls?.[5] || '';
    }

    // Fallback to displayReports if not resolved
    if (!toxinMap && displayReports[colIdx]?.toxinMapUrl) {
      toxinMap = displayReports[colIdx].toxinMapUrl;
    }
    if (!phytoMap && displayReports[colIdx]?.phytoMapUrl) {
      phytoMap = displayReports[colIdx].phytoMapUrl;
    }

    return {
      colIdx,
      offset,
      weekNum,
      dateRangeLabel,
      toxinMap,
      phytoMap,
      colStart: colStart.toISOString(),
      colEnd: colEnd.toISOString(),
      isCurrent: offset === 0
    };
  });

  const [quickUploadInfo, setQuickUploadInfo] = useState<{
    weekNum: number;
    mapType: 'toxin' | 'phyto';
    colStart: string;
    colEnd: string;
    colIdx: number;
  } | null>(null);
  const quickUploadInputRef = useRef<HTMLInputElement>(null);

  const triggerQuickUpload = (weekNum: number, mapType: 'toxin' | 'phyto', colStart: string, colEnd: string, colIdx: number) => {
    setQuickUploadInfo({ weekNum, mapType, colStart, colEnd, colIdx });
    quickUploadInputRef.current?.click();
  };

  const handleQuickUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quickUploadInfo) return;

    try {
      toast.loading('Processing image...', { id: 'quick-upload' });
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawResult = reader.result as string;
          const compressed = await compressImage(rawResult);
          const { weekNum, mapType, colStart, colEnd, colIdx } = quickUploadInfo;
          
          setReports(prev => {
            const existingIdx = prev.findIndex(r => 
              r.type === bulletinType && (r.manualWeekNumber ?? r.weekNumber) === weekNum
            );
            
            let updatedList = [...prev];
            if (existingIdx >= 0) {
              const existing = updatedList[existingIdx];
              updatedList[existingIdx] = {
                ...existing,
                [mapType === 'toxin' ? 'toxinMapUrl' : 'phytoMapUrl']: compressed
              };
            } else {
              const newRep: WeeklyReport = {
                id: crypto.randomUUID(),
                type: bulletinType,
                weekNumber: weekNum,
                manualWeekNumber: weekNum,
                startDate: colStart,
                endDate: colEnd,
                targetDate: colStart,
                toxinMapUrl: mapType === 'toxin' ? compressed : '',
                phytoMapUrl: mapType === 'phyto' ? compressed : '',
                additionalMapUrls: [],
                createdAt: new Date().toISOString()
              };
              updatedList.push(newRep);
            }

            // Also keep latestReport additionalMapUrls in sync if updating previous weeks (offsets 1, 2, 3)
            const offset = 3 - colIdx;
            if (offset > 0 && latestReport) {
              const lIdx = updatedList.findIndex(r => r.id === latestReport.id);
              if (lIdx >= 0) {
                const addMaps = [...(updatedList[lIdx].additionalMapUrls || Array(6).fill(''))];
                const slot = (offset - 1) * 2 + (mapType === 'toxin' ? 0 : 1);
                addMaps[slot] = compressed;
                updatedList[lIdx] = {
                  ...updatedList[lIdx],
                  additionalMapUrls: addMaps
                };
              }
            }

            return updatedList.sort((a, b) => {
              const timeDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
              if (timeDiff !== 0) return timeDiff;
              return (a.manualWeekNumber ?? a.weekNumber) - (b.manualWeekNumber ?? b.weekNumber);
            });
          });
          
          toast.dismiss('quick-upload');
          toast.success(`Week ${weekNum} ${mapType === 'toxin' ? 'toxin' : 'phytoplankton'} map updated!`);
        } catch (err) {
          toast.dismiss('quick-upload');
          toast.error('Failed to process image');
        }
      };
      reader.readAsDataURL(file);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-50">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shetland Bulletin Manager</h1>
              <p className="text-xs text-slate-500 font-medium">Harmful & Toxic Algae Status Reporting</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              {/* Navigation Tabs relocated here */}
              <TabsList className="grid grid-cols-3 w-full sm:w-72 bg-slate-100/80 border border-slate-200 shadow-sm h-9 p-1">
                <TabsTrigger value="bulletin" className="text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all h-7">
                  <LayoutDashboard className="w-3.5 h-3.5 mr-1" />
                  Bulletin
                </TabsTrigger>
                <TabsTrigger value="history" className="text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all h-7">
                  <History className="w-3.5 h-3.5 mr-1" />
                  History
                </TabsTrigger>
                <TabsTrigger value="admin" className="text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all h-7">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </TabsTrigger>
              </TabsList>

              <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-2 p-1 bg-slate-100/50 border border-slate-200 rounded-lg shadow-sm">
                <select 
                  value={bulletinType} 
                  onChange={(e) => {
                    setBulletinType(e.target.value as BulletinType);
                    setSelectedReportId(null);
                  }}
                  className="px-3 py-1 bg-transparent border-none text-xs font-bold uppercase tracking-tight focus:outline-none focus:ring-0 cursor-pointer hover:text-blue-600 transition-colors"
                >
                  <option value={BulletinType.DSP}>DSP</option>
                  <option value={BulletinType.PSP}>PSP</option>
                  <option value={BulletinType.ASP}>ASP</option>
                  <option value={BulletinType.AZA_YTX}>AZA/YTX</option>
                  <option value={BulletinType.SST}>SST</option>
                  <option value={BulletinType.SSC}>SSC</option>
                  <option value={BulletinType.KARENIA}>KARENIA</option>
                  <option value={BulletinType.CHLOROPHYLL}>CHLOROPHYLL</option>
                  <option value={BulletinType.WIND_ROSE}>WIND ROSE</option>
                  <option value={BulletinType.SUMMARY}>SUMMARY</option>
                  <option value={BulletinType.FORECAST}>FORECAST</option>
                  <option value={BulletinType.ANALYSIS}>ANALYSIS</option>
                </select>
              </div>

              <div className="flex gap-2 ml-auto">
                {reports.length === 0 && (
                  <Button variant="outline" size="sm" onClick={loadSampleData} className="bg-white border-slate-200 shadow-sm h-8 text-xs font-bold uppercase py-0 px-3">
                    Sample
                  </Button>
                )}
                {bulletinType === BulletinType.ANALYSIS && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => startEditingAnalysis()} 
                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-sm h-8 text-xs font-bold uppercase py-0 px-3 flex items-center gap-1.5"
                    title="Edit written analysis in memory"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-700" />
                    Edit Analysis
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => window.print()} disabled={reports.length === 0} className="bg-white border-slate-200 shadow-sm h-8 text-xs font-bold uppercase py-0 px-3">
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print
                </Button>
                <Button variant="default" size="sm" onClick={exportToPDF} disabled={reports.length === 0} className="bg-blue-600 hover:bg-blue-700 shadow-sm h-8 text-xs font-bold uppercase py-0 px-3">
                  <FileDown className="w-3.5 h-3.5 mr-1.5" />
                  PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Bulletin Display Area - Always mounted for PDF capture but hidden when not active */}
          <div className={activeTab === 'bulletin' ? "mt-2" : "hidden invisible h-0 overflow-hidden"}>
            {reports.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <CardContent className="flex flex-col items-center gap-4">
                  <LayoutDashboard className="w-12 h-12 text-slate-300" />
                  <div className="space-y-1">
                    <p className="text-lg font-medium">No data available</p>
                    <p className="text-slate-500">Add your first weekly report in the "Add Week" tab.</p>
                  </div>
                  <Button onClick={() => setActiveTab('admin')}>Get Started</Button>
                </CardContent>
              </Card>
            ) : (
              <div 
                ref={bulletinRef} 
                id="bulletin-board"
                className="bg-white border-none shadow-none ring-0 overflow-visible"
              >
                {/* Bulletin Header */}
                <div className="bg-[#1d4ed8] text-white py-4 px-4 w-full border-none shadow-none ring-0 m-0 text-center">
                  <h2 className="inline-block text-xl md:text-2xl font-bold tracking-tight m-0 border-none outline-none leading-none whitespace-nowrap">
                    Shetland Bulletin on the status of harmful & toxic algae Week {
                      activeTab === 'admin' 
                        ? (formData.manualWeekNumber || (formData.date && isValid(new Date(formData.date)) ? getWeek(new Date(formData.date), { weekStartsOn: 1, firstWeekContainsDate: 4 }) : 'X')) 
                        : (latestReport?.manualWeekNumber ?? latestReport?.weekNumber ?? 'X')
                    }, {
                      activeTab === 'admin'
                        ? (formData.manualDateRange || (formData.date && isValid(new Date(formData.date)) ? formatBulletinDateRange(
                            format(startOfWeek(new Date(formData.date), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                            format(endOfWeek(new Date(formData.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
                          ) : ''))
                        : (latestReport?.manualDateRange ?? (latestReport ? formatBulletinDateRange(latestReport.startDate, latestReport.endDate) : ''))
                    }
                  </h2>
                </div>

                <div className="p-3 space-y-3 bg-white border-none">
                  {/* Main Title */}
                  <h3 className="text-sm font-bold text-center text-black pb-1 uppercase tracking-wide">
                    {bulletinConfig[bulletinType].title}
                  </h3>

                  {(bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.CHLOROPHYLL) ? (
                    // Specialized Layout for Sea Surface Temperature, Currents and Chlorophyll
                    <div className="space-y-4">
                      {bulletinType === BulletinType.SST ? (
                        // SST: 3x2 Grid (6 days) - Legend on left
                        <div className="grid grid-cols-12 gap-4 items-start">
                          <div className="col-span-1 flex flex-col justify-center pt-8">
                            <div className="bg-slate-50/20 p-1 rounded-md border border-slate-100/50">
                              {React.createElement(bulletinConfig[bulletinType].legend)}
                            </div>
                          </div>
                          <div className="col-span-11 pt-2">
                            <div className="grid grid-cols-3 gap-x-3 gap-y-6">
                              {[latestReport?.toxinMapUrl, latestReport?.phytoMapUrl, ...(latestReport?.additionalMapUrls || [])].slice(0, 6).map((url, idx) => {
                                const manualDate = latestReport?.mapDates?.[idx];
                                const baseDate = latestReport ? parseISO(latestReport.targetDate) : null;
                                const defaultDate = baseDate && isValid(baseDate) ? addDays(baseDate, idx) : null;
                                const displayDate = manualDate ? parseISO(manualDate) : defaultDate;
                                
                                return (
                                  <div key={idx} className="flex flex-col gap-1.5 items-center">
                                    {displayDate && isValid(displayDate) && (
                                      <span className="text-[10px] font-bold text-black">{format(displayDate, 'd MMM yyyy')}</span>
                                    )}
                                    <div className="w-full aspect-[4/3] overflow-hidden flex items-center justify-center bg-white border border-black/5 shadow-sm">
                                      {url ? (
                                        <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                      ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-100 gap-2 h-full">
                                          <LayoutDashboard className="w-8 h-8 opacity-10" />
                                          <span className="text-[8px] font-semibold">TBD</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : bulletinType === BulletinType.CHLOROPHYLL ? (
                        // Chlorophyll: 3-Column Landscape Layout maximizing map size
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-x-3 gap-y-6">
                            {[latestReport?.toxinMapUrl, latestReport?.phytoMapUrl, ...(latestReport?.additionalMapUrls || [])].slice(0, 5).map((url, idx) => {
                              const manualDate = latestReport?.mapDates?.[idx];
                              const baseDate = latestReport ? parseISO(latestReport.targetDate) : null;
                              const displayDate = manualDate ? parseISO(manualDate) : (baseDate && isValid(baseDate) ? addDays(baseDate, idx) : null);
                              
                              const isFourthMap = idx === 3;
                              
                              if (isFourthMap) {
                                return (
                                  <React.Fragment key={idx}>
                                    <div className="flex flex-col items-center gap-1.5">
                                      {displayDate && isValid(displayDate) && (
                                        <span className="text-[10px] font-bold text-black">{format(displayDate, 'd MMM yyyy')}</span>
                                      )}
                                      <div className="w-full aspect-[4/3] overflow-hidden flex items-center justify-center bg-white border border-black/5 shadow-sm">
                                        {url ? (
                                          <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                        ) : (
                                          <div className="flex flex-col items-center justify-center text-slate-100 gap-2 h-full">
                                            <LayoutDashboard className="w-6 h-6 opacity-10" />
                                            <span className="text-[8px] font-semibold uppercase">TBD</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col justify-center items-center px-4">
                                       <p className="text-[12px] leading-relaxed text-black text-center font-medium">
                                        {latestReport?.commentary || 'These diagrams show the mass concentration of chlorophyll-a around Shetland. Yellows to reds indicate higher concentrations. However it should be noted that turbidity and the presence of organic material deposited into near shore areas can give false positive readings making the concentrations appear much higher than in situ observations would indicate.'}
                                      </p>
                                    </div>
                                  </React.Fragment>
                                );
                              }

                              return (
                                <div key={idx} className="flex flex-col items-center gap-1.5">
                                  {displayDate && isValid(displayDate) && (
                                    <span className="text-[10px] font-bold text-black">{format(displayDate, 'd MMM yyyy')}</span>
                                  )}
                                  <div className="w-full aspect-[4/3] overflow-hidden flex items-center justify-center bg-white border border-black/5 shadow-sm">
                                    {url ? (
                                      <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                    ) : (
                                      <div className="flex flex-col items-center justify-center text-slate-100 gap-2 h-full">
                                        <LayoutDashboard className="w-6 h-6 opacity-10" />
                                        <span className="text-[8px] font-semibold uppercase">TBD</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        // SSC: Commentary | 2x2 Grid | Legend
                        <div className="grid grid-cols-12 gap-4 items-start">
                          <div className="col-span-3 flex flex-col gap-4 text-center">
                            <div className="p-2 border-none">
                              <p className="text-[10px] leading-relaxed text-black italic">
                                {latestReport?.commentary || 'These diagrams show the predicted current directions around Shetland for the next couple of days. Greens to reds indicate stronger currents. In general strong currents run parallel to the deep water channel between the Faroes and Shetland. Problems can arise when these currents turn Eastwards potentially carrying Dinophysis and Karenia mikimotoi blooms, from the shelf edge, into shore.'}
                              </p>
                            </div>
                            <div className="flex justify-center">
                              {React.createElement(bulletinConfig[bulletinType].legend)}
                            </div>
                          </div>
                          <div className="col-span-9">
                            <div className="grid grid-cols-2 gap-x-2 gap-y-4">
                              {[latestReport?.toxinMapUrl, latestReport?.phytoMapUrl, ...(latestReport?.additionalMapUrls || [])].slice(0, 4).map((url, idx) => {
                                const manualDate = latestReport?.mapDates?.[idx];
                                const baseDate = latestReport ? parseISO(latestReport.targetDate) : null;
                                const weekOffset = bulletinType === BulletinType.SSC ? 7 : 0;
                                const defaultDate = baseDate && isValid(baseDate) ? addDays(baseDate, idx + weekOffset) : null;
                                const displayDate = manualDate ? parseISO(manualDate) : defaultDate;
                                
                                return (
                                  <div key={idx} className="flex flex-col items-center gap-1.5">
                                    {displayDate && isValid(displayDate) && (
                                      <span className="text-[12px] font-bold text-black">{format(displayDate, 'd MMM yyyy')}</span>
                                    )}
                                    <div className="overflow-hidden w-full">
                                      <div className="aspect-[4/3] w-full rounded-none flex items-center justify-center overflow-hidden">
                                        {url ? (
                                          <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                        ) : (
                                          <div className="flex flex-col items-center justify-center text-slate-100 gap-2 h-full">
                                            <LayoutDashboard className="w-6 h-6 opacity-10" />
                                            <span className="text-[8px] font-semibold uppercase">TBD</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Footer for Environmental Pages */}
                      <div className="pt-4 flex items-center justify-between">
                        <p className="text-[10px] font-medium text-black italic">
                          {bulletinConfig[bulletinType].footer}
                        </p>
                        {bulletinType === BulletinType.SSC && (
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Powered by</span>
                            <div className="flex flex-col items-center leading-none">
                              <span className="text-blue-900 font-extrabold text-[12px]">Mercator</span>
                              <span className="text-blue-500 font-bold text-[8px]">Ocean</span>
                            </div>
                          </div>
                        )}
                        {bulletinType === BulletinType.SST && (
                          <div className="flex items-center gap-1">
                            <div className="bg-blue-900 text-white px-1.5 py-0.5 text-[10px] font-black rounded">NASA</div>
                            <div className="text-red-600 font-black text-[12px] italic tracking-tighter ml-1">JPL</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : bulletinType === BulletinType.FORECAST ? (
                    // Wind and Rain Forecast Layout
                    <div className="space-y-0.5">
                      {/* Grid Header */}
                      <div className="grid grid-cols-[96px_1fr_1fr_1fr_1fr] gap-2 items-center text-center pb-0.5">
                        <div className="text-[10px] font-bold text-black border-b border-black/10 pb-0.5">Date</div>
                        <div className="text-[10px] font-bold text-black border-b border-black/10 pb-0.5 mx-2">6 AM</div>
                        <div className="text-[10px] font-bold text-black border-b border-black/10 pb-0.5 mx-2">12 Noon</div>
                        <div className="text-[10px] font-bold text-black border-b border-black/10 pb-0.5 mx-2">6 PM</div>
                        <div className="text-[10px] font-bold text-black border-b border-black/10 pb-0.5 mx-2">12 PM</div>
                      </div>

                      {/* Forecast Rows */}
                      <div className="space-y-1">
                        {[0, 1, 2].map(rowIdx => {
                          const rowDate = latestReport?.forecastDates?.[rowIdx];
                          const formattedDate = (() => {
                            if (rowDate && rowDate.trim() !== '') {
                              const trimmed = rowDate.trim();
                              if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                                const p = parseISO(trimmed);
                                if (isValid(p)) return format(p, 'd MMM yyyy');
                              }
                              const d = new Date(trimmed);
                              if (isValid(d) && !isNaN(d.getTime()) && trimmed.length >= 8) {
                                return format(d, 'd MMM yyyy');
                              }
                              return trimmed;
                            }
                            if (latestReport?.targetDate || latestReport?.startDate) {
                              const base = parseISO(latestReport.targetDate || latestReport.startDate);
                              if (isValid(base)) return format(addDays(base, rowIdx + 1), 'd MMM yyyy');
                            }
                            return format(addDays(new Date(), rowIdx + 1), 'd MMM yyyy');
                          })();
                          
                          const rowMaps = rowIdx === 0 
                            ? [
                                latestReport?.toxinMapUrl || latestReport?.additionalMapUrls?.[0], 
                                latestReport?.phytoMapUrl || latestReport?.additionalMapUrls?.[1], 
                                latestReport?.toxinMapUrl ? latestReport?.additionalMapUrls?.[0] : latestReport?.additionalMapUrls?.[2], 
                                latestReport?.phytoMapUrl ? latestReport?.additionalMapUrls?.[1] : latestReport?.additionalMapUrls?.[3]
                              ]
                            : rowIdx === 1
                              ? [
                                  latestReport?.additionalMapUrls?.[2] || latestReport?.additionalMapUrls?.[4], 
                                  latestReport?.additionalMapUrls?.[3] || latestReport?.additionalMapUrls?.[5], 
                                  latestReport?.additionalMapUrls?.[4] || latestReport?.additionalMapUrls?.[6], 
                                  latestReport?.additionalMapUrls?.[5] || latestReport?.additionalMapUrls?.[7]
                                ]
                              : [
                                  latestReport?.additionalMapUrls?.[6], 
                                  latestReport?.additionalMapUrls?.[7], 
                                  latestReport?.additionalMapUrls?.[8], 
                                  latestReport?.additionalMapUrls?.[9]
                                ];

                          return (
                            <div key={rowIdx} className="grid grid-cols-[96px_1fr_1fr_1fr_1fr] gap-2 items-center">
                              <div className="text-center flex flex-col items-center justify-center">
                                <span className="text-[11px] font-bold text-black border border-black/20 px-1.5 py-0.5 rounded-sm shadow-sm bg-slate-50 whitespace-nowrap">
                                  {formattedDate}
                                </span>
                              </div>
                              {rowMaps.map((url, colIdx) => (
                                <div key={colIdx} className="aspect-[1.3] w-full overflow-hidden border border-black shadow-[1px_1px_0px_rgba(0,0,0,0.1)]">
                                  {url ? (
                                    <img src={url} className="w-full h-full object-contain bg-white contrast-[1.05]" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-50 italic text-[10px] text-slate-300 font-bold uppercase">Pending</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {/* Scale Legend (Optional, based on screenshot) */}
                      <div className="pt-2 flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] font-bold text-black/60 uppercase tracking-tighter">Rain rate (" per hour)</span>
                        </div>
                        <div className="flex h-2 w-3/4 border border-black overflow-hidden shadow-sm">
                           {[
                             { color: '#ffffff', label: '0' },
                             { color: '#e0f2fe', label: '.01' },
                             { color: '#9de5f7', label: '.5' },
                             { color: '#4ade80', label: '1' },
                             { color: '#22c55e', label: '1.5' },
                             { color: '#ea580c', label: '2' },
                             { color: '#dc2626', label: '2.5' },
                             { color: '#991b1b', label: '3' },
                             { color: '#7f1d1d', label: '3.5' },
                             { color: '#fb7185', label: '4' },
                             { color: '#e11d48', label: '4.5' },
                             { color: '#be123c', label: '5' }
                           ].map((item, i) => (
                             <div key={i} className="flex-1 h-full" style={{ backgroundColor: item.color }} title={item.label} />
                           ))}
                        </div>
                        <div className="flex w-3/4 justify-between px-0.5">
                           {['.01', '.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map((val, i) => (
                             <span key={i} className="text-[7px] font-bold text-black">{val}</span>
                           ))}
                        </div>
                      </div>
                      
                      <div className="text-center pt-1">
                         <p className="text-[8px] font-medium text-black/40 italic">{bulletinConfig[bulletinType].footer}</p>
                      </div>
                    </div>
                  ) : bulletinType === BulletinType.ANALYSIS ? (
                    // Analysis/Report Layout with Auto-resizing boxes and full additional text support
                    <div className="flex flex-col h-auto min-h-full gap-3">
                      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-3.5 items-stretch">
                        {/* Left Column: Two stacked boxes that automatically expand to fit text */}
                        <div className="space-y-3.5 flex flex-col justify-between">
                          {/* Biotoxin Report Box */}
                          <div className="bg-[#fdf3da] border border-[#d4a017] p-3.5 shadow-sm rounded-sm h-auto transition-all duration-150">
                            <div className="flex items-center justify-between border-b border-[#d4a017]/30 pb-1 mb-2">
                              <h3 className="text-base md:text-lg font-black text-[#1e3a8a] uppercase tracking-tight">Biotoxin report:</h3>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded border border-[#f59e0b]/30">Auto-resizing</span>
                                <button
                                  type="button"
                                  onClick={() => startEditingAnalysis('biotoxin')}
                                  className="text-[9px] font-bold text-[#1e3a8a] hover:text-blue-800 hover:bg-white flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded border border-[#d4a017]/40 shadow-2xs transition-colors cursor-pointer"
                                  title="Edit Biotoxin text in memory"
                                >
                                  <Pencil className="w-2.5 h-2.5 text-[#b45309]" />
                                  Edit Text
                                </button>
                              </div>
                            </div>
                            <div className="text-[9.5px] space-y-1 text-black font-semibold">
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">ASP toxins:</span> {latestReport?.biotoxins?.asp || 'Not detected or below regulatory limits'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">AZA toxins:</span> {latestReport?.biotoxins?.aza || 'Not detected or below regulatory limits'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">DSP toxins:</span> {latestReport?.biotoxins?.dsp || 'Not detected or below regulatory limits'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">PSP toxins:</span> {latestReport?.biotoxins?.psp || 'Not detected or below regulatory limits'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">YTX toxins:</span> {latestReport?.biotoxins?.ytx || 'Not detected or below regulatory limits'}</p>
                            </div>
                            {latestReport?.biotoxinReport && (
                              <div className="mt-2.5 pt-2 border-t border-[#d4a017]/40">
                                <span className="font-bold block uppercase tracking-tight text-[#1e3a8a] text-[8.5px] mb-1">Additional Text & General Summary:</span>
                                <p className="text-[9.5px] leading-relaxed text-black/90 font-medium whitespace-pre-wrap break-words bg-amber-50/60 p-2 rounded border border-[#d4a017]/20">
                                  {latestReport.biotoxinReport}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Harmful Algae Report Box */}
                          <div className="bg-[#fdf3da] border border-[#d4a017] p-3.5 shadow-sm rounded-sm h-auto transition-all duration-150">
                            <div className="flex items-center justify-between border-b border-[#d4a017]/30 pb-1 mb-2">
                              <h3 className="text-base md:text-lg font-black text-[#1e3a8a] uppercase tracking-tight">Harmful algae report:</h3>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded border border-[#f59e0b]/30">Auto-resizing</span>
                                <button
                                  type="button"
                                  onClick={() => startEditingAnalysis('harmfulAlgae')}
                                  className="text-[9px] font-bold text-[#1e3a8a] hover:text-blue-800 hover:bg-white flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded border border-[#d4a017]/40 shadow-2xs transition-colors cursor-pointer"
                                  title="Edit Harmful Algae text in memory"
                                >
                                  <Pencil className="w-2.5 h-2.5 text-[#b45309]" />
                                  Edit Text
                                </button>
                              </div>
                            </div>
                            <div className="text-[9.5px] space-y-1 text-black font-semibold">
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">Alexandrium:</span> {latestReport?.harmfulAlgae?.alexandrium || '< 20 cells/l (Below threshold)'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">Dinophysis:</span> {latestReport?.harmfulAlgae?.dinophysis || 'Present at low levels (Below threshold)'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">Karenia mikimotoi:</span> {latestReport?.harmfulAlgae?.karenia || 'Not detected'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">Prorocentrum lima:</span> {latestReport?.harmfulAlgae?.prorocentrum || '< 40 cells/l (Below threshold)'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">Pseudo-nitzschia delicatissima:</span> {latestReport?.harmfulAlgae?.pseudoDelicatissima || 'Background levels'}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-bold">Pseudo-nitzschia seriata:</span> {latestReport?.harmfulAlgae?.pseudoSeriata || 'Background levels'}</p>
                            </div>
                            {latestReport?.harmfulAlgaeReport && (
                              <div className="mt-2.5 pt-2 border-t border-[#d4a017]/40">
                                <span className="font-bold block uppercase tracking-tight text-[#1e3a8a] text-[8.5px] mb-1">Additional Text & General Summary:</span>
                                <p className="text-[9.5px] leading-relaxed text-black/90 font-medium whitespace-pre-wrap break-words bg-amber-50/60 p-2 rounded border border-[#d4a017]/20">
                                  {latestReport.harmfulAlgaeReport}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Column: Large box that automatically expands */}
                        <div className="bg-[#5a7fbf] border border-[#1e3a8a] p-4 flex flex-col justify-between shadow-md text-white rounded-sm h-auto transition-all duration-150">
                          <div>
                            <div className="flex items-center justify-between border-b border-white/20 pb-1.5 mb-2.5">
                              <h3 className="text-lg md:text-xl font-black uppercase tracking-tight">Shetland: trends and forecast</h3>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-white bg-blue-900/60 px-2 py-0.5 rounded border border-white/20">Auto-resizing</span>
                                <button
                                  type="button"
                                  onClick={() => startEditingAnalysis('trends')}
                                  className="text-[9px] font-bold text-white hover:text-blue-100 hover:bg-blue-950/70 flex items-center gap-1 bg-blue-900/70 px-2 py-0.5 rounded border border-white/25 shadow-2xs transition-colors cursor-pointer"
                                  title="Edit Trends & Forecast text in memory"
                                >
                                  <Pencil className="w-2.5 h-2.5 text-white" />
                                  Edit Text
                                </button>
                              </div>
                            </div>
                            <div className="text-xs font-normal leading-relaxed space-y-2.5">
                              {latestReport?.trends?.alexandriumPsp && (
                                <div className="italic">
                                  <p className="whitespace-pre-wrap break-words"><span className="font-bold not-italic text-white">Alexandrium/PSP:</span> {latestReport?.trends?.alexandriumPsp}</p>
                                </div>
                              )}
                              {latestReport?.trends?.dinophysisDsp && (
                                <div className="italic">
                                  <p className="whitespace-pre-wrap break-words"><span className="font-bold not-italic text-white">Dinophysis/DSP:</span> {latestReport?.trends?.dinophysisDsp}</p>
                                </div>
                              )}
                              {latestReport?.trends?.pseudoNitzschiaAsp && (
                                <div className="italic">
                                  <p className="whitespace-pre-wrap break-words"><span className="font-bold not-italic text-white">Pseudo-nitzschia/ASP:</span> {latestReport?.trends?.pseudoNitzschiaAsp}</p>
                                </div>
                              )}
                              {latestReport?.trends?.azaYtx && (
                                <div className="italic">
                                  <p className="whitespace-pre-wrap break-words"><span className="font-bold not-italic text-white">AZA and YTX:</span> {latestReport?.trends?.azaYtx}</p>
                                </div>
                              )}
                              
                              <div className="pt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-black/20 p-2 rounded border border-white/10 text-[10px]">
                                 <p><span className="font-bold text-white/80">Risk PSP:</span> <span className="font-extrabold uppercase">{latestReport?.trends?.riskPsp || 'Low'}</span></p>
                                 <p><span className="font-bold text-white/80">Risk DSP:</span> <span className="font-extrabold uppercase">{latestReport?.trends?.riskDsp || 'Low'}</span></p>
                                 <p><span className="font-bold text-white/80">Risk ASP:</span> <span className="font-extrabold uppercase">{latestReport?.trends?.riskAsp || 'Low'}</span></p>
                                 <p><span className="font-bold text-white/80">Risk YTX:</span> <span className="font-extrabold uppercase">{latestReport?.trends?.riskYtx || 'Low'}</span></p>
                                 <p><span className="font-bold text-white/80">Risk AZA:</span> <span className="font-extrabold uppercase">{latestReport?.trends?.riskAza || 'Low'}</span></p>
                              </div>

                              {latestReport?.trendsForecast && (
                                <div className="mt-2.5 pt-2 border-t border-white/20">
                                  <span className="font-bold block uppercase tracking-tight text-white text-[9px] mb-1">Additional Text & Overall Commentary:</span>
                                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words bg-black/25 p-2.5 rounded border border-white/10 font-normal">
                                    {latestReport.trendsForecast}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-white/20 text-[9px] font-bold opacity-95 leading-snug">
                            {bulletinConfig[bulletinType].footer}
                          </div>
                        </div>
                      </div>

                      {/* Warning/Threshold and Permitted Levels Tables */}
                      <div className="grid grid-cols-[1.4fr_1.6fr] gap-3 mt-1">
                        <div className="border border-black/20 p-1.5 bg-white flex flex-col">
                           <h4 className="text-[8px] font-black uppercase text-center border-b border-black/10 pb-0.5 mb-0.5">Warning/Threshold Levels</h4>
                           <div className="grid grid-cols-2 gap-x-2 text-[7px] leading-tight">
                              <div className="space-y-0.5">
                                <p><span className="font-bold italic">Alexandrium</span> (PSP causative)</p>
                                <p className="text-right border-b border-dotted border-black/10 pb-0.5">Warning 20 cells/l<br/>Threshold 40 cells/l</p>
                              </div>
                              <div className="space-y-0.5">
                                <p><span className="font-bold italic">Pseudo nitzschia</span> (ASP causative)</p>
                                <p className="text-right border-b border-dotted border-black/10 pb-0.5">Warning: 40,000 cells/l<br/>Threshold: 50,000 cells/l</p>
                              </div>
                              <div className="space-y-0.5">
                                <p><span className="font-bold italic">Dinophysis</span> (DSP causative)</p>
                                <p className="text-right">Warning : 80 cells/l<br/>Threshold:100 cells/l</p>
                              </div>
                              <div className="space-y-0.5">
                                <p><span className="font-bold italic">Prorocentrum lima</span> (DSP causative)</p>
                                <p className="text-right">Warning: 80 cells/l<br/>Threshold: 100 cells/l</p>
                              </div>
                           </div>
                        </div>

                        <div className="border border-[#d97706]/20 p-1.5 bg-[#fef3c7]/30">
                           <h4 className="text-[8px] font-bold mb-0.5">The maximum permitted levels of biotoxins in shellfish are:</h4>
                           <div className="grid grid-cols-2 gap-x-2 text-[7px] leading-tight">
                              <p><span className="font-bold">PSP:</span> 800 µg/kg</p>
                              <p><span className="font-bold">ASP:</span> 20 mg/kg</p>
                              <p className="col-span-2 mt-0.5"><span className="font-bold uppercase text-[6px] block">Lipophilic toxins (tested by LC-MS):</span></p>
                              <p><span className="font-bold">OA/DTXs/PTXs:</span> 160 ug/kg of Okadaic acid equivalents</p>
                              <p><span className="font-bold">YTXs:</span> 3.75 milligram of yessotoxin equivalent/kilogram</p>
                              <p><span className="font-bold">AZAs:</span> 160 micrograms of azaspiracids equivalents/kilogram</p>
                           </div>
                        </div>
                      </div>

                      {/* Footer Logos Section (to match screenshot) */}
                      <div className="border-t border-slate-200 mt-1 pt-1.5 flex flex-col gap-2">
                        <div className="grid grid-cols-4 gap-2 items-center">
                          <div className="flex items-center justify-center gap-2">
                             <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm p-1">
                               <svg viewBox="0 0 36 36" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                                 <circle cx="18" cy="18" r="17" fill="#f0f9ff" stroke="#0284c7" strokeWidth="1.5"/>
                                 <path d="M6 21 C 11 16, 16 24, 21 19 C 25 15, 29 17, 31 20 C 28 23, 23 19, 19 22 C 14 26, 10 24, 6 21 Z" fill="#1e3a8a"/>
                                 <path d="M9 25 C 13 22, 17 27, 22 23 C 26 20, 29 22, 30 24 C 27 26, 23 24, 20 26 C 15 29, 12 28, 9 25 Z" fill="#0284c7" fillOpacity="0.85"/>
                                 <circle cx="18" cy="11" r="2.5" fill="#38bdf8"/>
                               </svg>
                             </div>
                             <div className="flex flex-col">
                               <span className="text-lg font-black text-[#1e3a8a] tracking-tighter leading-none">SAMS</span>
                               <span className="text-[5.5px] font-bold text-slate-500 uppercase tracking-tight leading-none mt-0.5">Marine Science</span>
                             </div>
                          </div>

                          <div className="flex flex-col items-center justify-center border-l border-slate-200 px-2">
                            <span className="text-lg font-black text-blue-500 italic tracking-tighter">SeafoodShetland</span>
                            <span className="text-[6px] font-bold text-slate-400 text-center uppercase tracking-widest mt-0.5">Funding for these bulletins is kindly provided by Seafood Shetland</span>
                          </div>

                          <div className="flex items-center justify-center gap-1.5 border-l border-slate-200 px-2">
                             <div className="h-6 flex items-center shrink-0">
                               <svg viewBox="0 0 110 32" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                                 <g transform="translate(1, 2)">
                                   <rect x="0" y="0" width="28" height="28" rx="5" fill="#f0fdfa" stroke="#0d9488" strokeWidth="1.2"/>
                                   <path d="M5 20 C 9 13, 17 13, 23 20 C 19 17, 11 17, 5 20 Z" fill="#00667e"/>
                                   <path d="M7 15 C 11 9, 17 9, 21 15 C 17 12, 11 12, 7 15 Z" fill="#0d9488"/>
                                   <circle cx="14" cy="7" r="2" fill="#14b8a6"/>
                                 </g>
                                 <text x="35" y="19" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="900" fill="#00667e" letterSpacing="-0.5">Cefas</text>
                                 <text x="36" y="27" fontFamily="system-ui, -apple-system, sans-serif" fontSize="5" fontWeight="700" fill="#0f766e" letterSpacing="0.1">Executive Agency</text>
                               </svg>
                             </div>
                             <span className="text-[6px] font-medium text-slate-500 leading-tight">Toxin concentrations provided courtesy of Cefas</span>
                          </div>

                          <div className="bg-[#fef3c7] p-1.5 border border-[#d97706]/20 rounded-sm">
                             <p className="text-[6px] font-bold text-[#92400e]/80 uppercase leading-tight">
                               Primary data for biotoxins available at: 
                               <br />
                               <span className="lowercase font-medium">http://www.food.gov.uk/enforcement/shellfish/algaltoxin/</span>
                             </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : bulletinType === BulletinType.WIND_ROSE ? (
                    // Wind Rose Layout
                    <div className="space-y-4 pt-2">
                      {/* Weekly Comparison Row */}
                      <div className="grid grid-cols-4 gap-6 px-2">
                         {[latestReport?.toxinMapUrl, latestReport?.phytoMapUrl, (latestReport?.additionalMapUrls?.[0]), (latestReport?.additionalMapUrls?.[1])].map((url, idx) => {
                           const currentWeek = latestReport?.manualWeekNumber || latestReport?.weekNumber || 0;
                           const weekNum = currentWeek ? currentWeek - (3 - idx) : (idx + 13); // fallback to example
                           return (
                             <div key={idx} className="flex flex-col items-center gap-2">
                               <h4 className="text-base font-bold text-black">Week {weekNum}</h4>
                               <div className="w-full aspect-square overflow-hidden flex items-center justify-center bg-white border border-slate-200/50 shadow-sm rounded-sm">
                                 {url ? (
                                   <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                 ) : (
                                   <div className="flex flex-col items-center justify-center text-slate-100 gap-2">
                                     <LayoutDashboard className="w-8 h-8 opacity-10" />
                                     <span className="text-[10px] font-semibold text-slate-300">W{weekNum} TBD</span>
                                   </div>
                                 )}
                               </div>
                             </div>
                           );
                         })}
                      </div>

                      {/* Bottom Row: Month Summary | Text | Predictions */}
                      <div className="grid grid-cols-12 gap-8 pt-4 items-start px-2">
                         {/* Monthly Summary & Status */}
                         <div className="col-span-3 space-y-4">
                            <div className="flex flex-col items-center gap-2">
                              <h4 className="text-base font-bold text-black">{latestReport?.windRoseMonth || 'Month'}</h4>
                              <div className="w-full aspect-square overflow-hidden flex items-center justify-center bg-white border border-slate-200/50 shadow-sm rounded-sm">
                                {latestReport?.additionalMapUrls?.[2] ? (
                                  <img src={latestReport.additionalMapUrls[2]} className="w-full h-full object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-slate-100 gap-2">
                                    <LayoutDashboard className="w-8 h-8 opacity-10" />
                                    <span className="text-[10px] font-semibold text-slate-300">MONTH TBD</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="bg-white p-0 border-none">
                              <h5 className="font-bold text-sm mb-1 uppercase tracking-tight">Status:</h5>
                              <div className="bg-slate-50/50 p-3 border border-slate-100 rounded-sm">
                                <p className="text-[11px] leading-relaxed font-bold text-black italic whitespace-pre-wrap">
                                  {latestReport?.kareniaStatus || 'Over the past week the average wind direction has been from the south east.'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Permanent Description + Predictions */}
                         <div className="col-span-9 space-y-6">
                            {/* Main Description */}
                            <div className="pt-2">
                              <p className="text-[14px] leading-relaxed text-black font-medium text-left whitespace-pre-wrap">
                                {latestReport?.commentary || 'Mean wind direction and speed observed in Shetland over the past four weeks. Higher wind speeds are shown in lighter shades. The percentage of time the wind blew from any particular direction is shown by the length of the triangle. The resultant vector, represented by the red or blue line, shows the average wind direction for the week. It is based on wind direction only and includes periods of calm which are not indicated on the diagram. The data used is taken from the weather station at Sumburgh.'}
                              </p>
                            </div>

                            {/* Predictions Box */}
                            <div className="bg-[#fbbf24] p-5 shadow-sm border border-black/5 rounded-sm flex flex-col">
                              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider border-b border-black/10 pb-1">Predictions:</h4>
                              <p className="text-[14px] font-bold text-black leading-snug mb-5">
                                The risk of wind blown <span className="italic">Dinophysis</span> blooms in Shetland is <span className="underline decoration-2 underline-offset-4 font-black uppercase tracking-widest">{latestReport?.predictionRisk || 'low'}</span> this week.
                              </p>
                              <h5 className="font-bold text-sm mb-2 uppercase tracking-tight">Why do we think this?</h5>
                              <p className="text-[12px] leading-relaxed text-black font-medium bg-white/30 p-3 rounded-sm whitespace-pre-wrap">
                                {latestReport?.predictionWhy || 'During the summer Dinophysis can bloom out at sea and at shelf fronts found off the West of Shetland. Westerly winds can then blow these blooms into shore. Westerly winds may also retain Dinophysis cells in Westerly facing voes and in lets where their numbers may increase. Wind for the past week has been predominantly from the south east. It is very unlikely that there will be an advected bloom of Dinophysis in the coming week.'}
                              </p>
                            </div>
                         </div>
                      </div>
                    </div>
                  ) : bulletinType === BulletinType.KARENIA ? (
                    // Specialized Layout for Karenia mikimotoi (4 Maps + Status + Gallery)
                    <div className="space-y-6">
                      
                      <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-2 translate-y-4">
                          {React.createElement(bulletinConfig[bulletinType].legend)}
                        </div>
                        <div className="col-span-10">
                          <div className="grid grid-cols-4 gap-2">
                             {[latestReport?.toxinMapUrl, latestReport?.phytoMapUrl, ...(latestReport?.additionalMapUrls || [])].slice(0, 4).map((url, idx) => {
                                return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    <div className="w-full aspect-[3/4] overflow-hidden flex items-center justify-center bg-white border border-black/5">
                                      {url ? (
                                        <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                      ) : (
                                        <LayoutDashboard className="w-8 h-8 text-slate-200 opacity-20" />
                                      )}
                                    </div>
                                  </div>
                                );
                             })}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1.1fr_1.9fr] gap-12 pt-4 px-12">
                        <div className="p-0 border-none shadow-none bg-transparent">
                          <h4 className="font-bold text-sm mb-3 uppercase tracking-tight pb-0.5 text-black">Chain forming Phytoplankton</h4>
                          <p className="text-[10px] leading-relaxed mb-4 font-medium text-black">
                            High densities of chain forming diatoms including, but not limited to the genus, Chaetoceros, Skeletonema, Leptocylindrus , Rhizosolenia, Thalassiosira, Corethron and Pseudo-nitzschia, the centric species Coscinodiscus wailesii, and species with long spines such as Ceratium (Tripos) can cause debilitating damage to fish gills.
                          </p>
                          
                          <div className="space-y-2 mt-4">
                            <h5 className="font-bold text-[10px] uppercase underline decoration-1 underline-offset-4 text-black">Status</h5>
                            <p className="text-[10px] leading-relaxed font-bold text-black italic whitespace-pre-wrap">
                              {latestReport?.kareniaStatus || 'No status available.'}
                            </p>
                            <a href="https://www.habreports.org/ifcb-nafc.php" target="_blank" rel="noopener noreferrer" className="text-[8px] text-blue-800 font-bold underline block pt-1 hover:text-blue-600 transition-colors">
                              https://www.habreports.org/ifcb-nafc.php
                            </a>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 items-center">
                          <div className="relative border-none bg-transparent flex items-center justify-center group overflow-hidden w-full">
                            <img 
                              src="/harmful_algae_salmon.png" 
                              alt="Phytoplankton Gallery Large"
                              className="w-full h-auto max-h-[260px] object-contain"
                              onError={(e) => {
                                const target = e.currentTarget;
                                // If the root image fails, try a few other names/locations just in case
                                if (target.src.endsWith('.png')) {
                                  target.src = "/harmful_algae_salmon.png.jpg";
                                } else {
                                  // Final fallback to a reliable scientific microscope image of phytoplankton community
                                  target.src = "https://images.unsplash.com/photo-1530533720215-4242624440bd?auto=format&fit=crop&q=80&w=800";
                                }
                              }}
                            />
                          </div>
                          <p className="text-[9px] font-bold text-black leading-[1.1] italic text-center max-w-[95%]">
                            A. Asterionellopsis spp. B. Chaetoceros spp. C. Thalassiosira spp. D. Skeletonema spp. E. Ceratium Horridum F. Karenia mikimotoi G. Pseudo-nitzschia spp.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : bulletinType === BulletinType.SUMMARY ? (
                    // Dashboard/Summary Layout
                    <div className="space-y-4 pt-1">
                      {/* 10 Gauges Grid: 5 Species (Row 1) + 5 Toxins (Row 2) */}
                      <div className="grid grid-cols-5 gap-2 px-1 py-1">
                        {[
                          { url: latestReport?.toxinMapUrl, name: 'Alexandrium' },
                          { url: latestReport?.phytoMapUrl, name: 'Dinophysis' },
                          { url: latestReport?.additionalMapUrls?.[0], name: 'Pseudo-nitzschia deli' },
                          { url: latestReport?.additionalMapUrls?.[1], name: 'Pseudo-nitzschia seri' },
                          { url: latestReport?.additionalMapUrls?.[2], name: 'Prorocentrum lima' },
                          { url: latestReport?.additionalMapUrls?.[3], name: 'PSP' },
                          { url: latestReport?.additionalMapUrls?.[4], name: 'DSP' },
                          { url: latestReport?.additionalMapUrls?.[5], name: 'ASP' },
                          { url: latestReport?.additionalMapUrls?.[6], name: 'YTXs' },
                          { url: latestReport?.additionalMapUrls?.[7], name: 'AZAs' }
                        ].map((item, idx) => (
                          <div key={idx} className="flex flex-col items-center justify-center w-full min-w-0">
                            <div 
                              className="w-full aspect-square overflow-hidden flex items-center justify-center bg-white border-2 border-slate-200 rounded-full shadow-md"
                              style={{ aspectRatio: '1 / 1' }}
                            >
                              {item.url ? (
                                <img 
                                  src={item.url} 
                                  alt={item.name}
                                  className="w-full h-full object-cover object-center contrast-[1.1] brightness-[1.05]" 
                                  referrerPolicy="no-referrer" 
                                  crossOrigin="anonymous" 
                                />
                              ) : (
                                <div className="text-[10px] font-bold text-slate-300">TBD</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Segment Description Box */}
                      <div className="bg-[#fef9c3] border border-[#fde047] p-2 text-center rounded-sm mx-1">
                        <p className="text-[10px] font-bold text-black leading-tight">
                          Segments - no of individual sites, Colours: Green, red, amber and yellow as per key. Blue - not analysed. Coloured segment indicates approximate position of site in Shetland
                        </p>
                      </div>

                      {/* Bottom Section: Table and Note */}
                      <div className="grid grid-cols-[1fr_240px] gap-4 px-1 pt-1">
                        <div className="overflow-hidden border border-black rounded-sm">
                          <table className="w-full border-collapse text-[9px]">
                            <thead className="bg-[#f1f5f9] font-bold text-black">
                              <tr>
                                <th className="border-r border-b border-black p-1 text-left uppercase">Biotoxin & Species</th>
                                <th className="border-r border-b border-black p-1 text-center bg-white">{"<RL"}</th>
                                <th className="border-r border-b border-black p-1 text-center bg-yellow-200">RL - 399 µg/kg</th>
                                <th className="border-r border-b border-black p-1 text-center bg-[#fbbf24]">400 - 800 µg/kg</th>
                                <th className="border-r border-b border-black p-1 text-center bg-red-600 text-white font-bold">{">800 µg/kg"}</th>
                                <th className="border-b border-black p-1 text-center bg-blue-500 text-white">Not analysed</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white font-medium text-black">
                              {[
                                { name: 'PSP', values: ['<RL', 'RL - 399 µg/kg', '400 - 800 µg/kg', '>800 µg/kg', 'Not analysed'] },
                                { name: 'OA/DTX/PTX', values: ['<RL', '1 - 79 µg/kg', '80 - 160 µg/kg', '>160 µg/kg', 'Not analysed'] },
                                { name: 'ASP', values: ['<LOQ', 'LOQ - 9.9 mg/kg', '10 - 20 mg/kg', '>20 mg/kg', 'Not analysed'] },
                                { name: 'YTX', values: ['<RL', '1 - 1.7 mg/kg', '1.8 - 3.75 mg/kg', '>3.75 mg/kg', 'Not analysed'] },
                                { name: 'AZA', values: ['<RL', '1 - 79 µg/kg', '80 -160 µg/kg', '>160 µg/kg', 'Not analysed'] },
                                { name: 'Alexandrium', values: ['<20 cells/l', 'n/a', '20 cells/l', '≥ 40 cells/l', 'Not sampled'] },
                                { name: 'Dinophysis', values: ['<20 cells/l', '20 - 79 cells/l', '80 - 99 cells/l', '≥100 cells/l', 'Not sampled'] },
                                { name: 'Pseudo nitzschia', values: ['<20 cells/l', '20 - 39,999 cells/l', '40,000 - 49,999 cells/l', '≥50,000 cells/l', 'Not sampled'] },
                                { name: 'Prorocentrum lima', values: ['<20 cells/l', '20 - 79 cells/l', '80 - 99 cells/l', '≥100 cells/l', 'Not sampled'] },
                              ].map((row, i) => (
                                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className="border-r border-b border-black p-0.5 px-2 font-bold italic">{row.name}</td>
                                  {row.values.map((val, j) => (
                                    <td key={j} className={`border-r border-b border-black p-0.5 text-center ${j === 4 ? "border-r-0" : ""}`}>{val}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-[#fbbf24] p-3 shadow-md border border-black/10 rounded-sm relative selection:bg-yellow-100 flex flex-col justify-start">
                          <h4 className="font-bold text-[12px] mb-2 uppercase tracking-wide border-b border-black/20 pb-1">NOTE:</h4>
                          <p className="text-[10px] leading-relaxed text-black font-medium">
                            This page is intended as a quick overview of the situation in the Shetland Islands. If the status for a particular species or biotoxin is amber or red please check the relevant pages in the bulletin for more details and specific locations.
                          </p>
                          <div className="mt-auto pt-4 space-y-0.5">
                            <p className="text-[9px] font-bold text-black leading-tight">RL- reporting limit;</p>
                            <p className="text-[9px] font-bold text-black leading-tight">LOQ – Limit of quantification</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Original Toxic Algae Layout (DSP, PSP, ASP, AZA)
                    <>
                      {/* Hidden quick upload input for direct map uploads from the bulletin */}
                      <input 
                        ref={quickUploadInputRef} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleQuickUploadFile} 
                      />

                      {/* Column Headers for the 4 Weeks */}
                      <div className="grid grid-cols-12 gap-3 items-center mb-0.5">
                        <div className="col-span-2"></div>
                        <div className="col-span-10 grid grid-cols-4 gap-2">
                          {toxinTimelineColumns.map((col) => (
                            <div 
                              key={`header-${col.colIdx}`} 
                              className={`text-center py-1 px-1 rounded-sm border ${
                                col.isCurrent 
                                  ? 'bg-blue-50/80 border-blue-300 shadow-xs' 
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[11px] font-black text-slate-900 tracking-tight">
                                  Week {col.weekNum}
                                </span>
                                {col.isCurrent && (
                                  <span className="text-[7px] font-bold uppercase bg-blue-600 text-white px-1 rounded-xs">
                                    Current
                                  </span>
                                )}
                              </div>
                              <span className="text-[8px] font-medium text-slate-500 block leading-none mt-0.5">
                                {col.dateRangeLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Row 1: Toxins */}
                      <div className="grid grid-cols-12 gap-3 items-stretch">
                        <div className="col-span-2">
                          {React.createElement(bulletinConfig[bulletinType].topLegend)}
                        </div>
                        <div className="col-span-10 grid grid-cols-4 gap-2">
                          {toxinTimelineColumns.map((col) => (
                            <div key={`toxin-col-${col.colIdx}`} className="relative group overflow-hidden border border-slate-200/80 rounded-xs bg-white">
                              <div className="aspect-[3/4] w-full rounded-none flex items-center justify-center overflow-hidden relative">
                                {col.toxinMap ? (
                                  <>
                                    <img 
                                      src={col.toxinMap} 
                                      alt={`Week ${col.weekNum} Toxin Map`} 
                                      className="w-full h-full object-contain"
                                      referrerPolicy="no-referrer"
                                      crossOrigin="anonymous"
                                    />
                                    {/* Hover overlay to change map */}
                                    <div 
                                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white gap-1 print:hidden"
                                      onClick={() => triggerQuickUpload(col.weekNum, 'toxin', col.colStart, col.colEnd, col.colIdx)}
                                    >
                                      <Upload className="w-5 h-5 text-white" />
                                      <span className="text-[9px] font-bold uppercase">Replace Map</span>
                                    </div>
                                  </>
                                ) : (
                                  <div 
                                    className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 p-2 bg-slate-50/80 hover:bg-blue-50/60 cursor-pointer transition-colors border-2 border-dashed border-slate-200 hover:border-blue-400 group/slot"
                                    onClick={() => triggerQuickUpload(col.weekNum, 'toxin', col.colStart, col.colEnd, col.colIdx)}
                                  >
                                    <Plus className="w-6 h-6 text-slate-400 group-hover/slot:text-blue-600 transition-colors" />
                                    <span className="text-[8px] font-bold uppercase text-slate-600 group-hover/slot:text-blue-700 text-center leading-tight">
                                      + Upload Week {col.weekNum} Map
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Row 2: Phytoplankton */}
                      <div className="grid grid-cols-12 gap-3 items-stretch">
                        <div className="col-span-2">
                          {React.createElement(bulletinConfig[bulletinType].bottomLegend)}
                        </div>
                        <div className="col-span-10 grid grid-cols-4 gap-2">
                          {toxinTimelineColumns.map((col) => (
                            <div key={`phyto-col-${col.colIdx}`} className="relative group overflow-hidden border border-slate-200/80 rounded-xs bg-white">
                              <div className="aspect-[3/4] w-full rounded-none flex items-center justify-center overflow-hidden relative">
                                {col.phytoMap ? (
                                  <>
                                    <img 
                                      src={col.phytoMap} 
                                      alt={`Week ${col.weekNum} Phyto Map`} 
                                      className="w-full h-full object-contain"
                                      referrerPolicy="no-referrer"
                                      crossOrigin="anonymous"
                                    />
                                    {/* Hover overlay to change map */}
                                    <div 
                                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white gap-1 print:hidden"
                                      onClick={() => triggerQuickUpload(col.weekNum, 'phyto', col.colStart, col.colEnd, col.colIdx)}
                                    >
                                      <Upload className="w-5 h-5 text-white" />
                                      <span className="text-[9px] font-bold uppercase">Replace Map</span>
                                    </div>
                                  </>
                                ) : (
                                  <div 
                                    className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 p-2 bg-slate-50/80 hover:bg-blue-50/60 cursor-pointer transition-colors border-2 border-dashed border-slate-200 hover:border-blue-400 group/slot"
                                    onClick={() => triggerQuickUpload(col.weekNum, 'phyto', col.colStart, col.colEnd, col.colIdx)}
                                  >
                                    <Plus className="w-6 h-6 text-slate-400 group-hover/slot:text-blue-600 transition-colors" />
                                    <span className="text-[8px] font-bold uppercase text-slate-600 group-hover/slot:text-blue-700 text-center leading-tight">
                                      + Upload Week {col.weekNum} Map
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <TabsContent value="history" className="mt-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Historical Reports</CardTitle>
                {reports.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={clearAllData}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {reports.filter(r => r.type === bulletinType).length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No historical data found for this category.</p>
                    ) : (
                      reports
                        .filter(r => r.type === bulletinType)
                        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                        .map((report) => (
                        <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="bg-blue-100 text-blue-700 w-12 h-12 rounded-full flex items-center justify-center font-bold">
                              W{report.weekNumber}
                            </div>
                            <div>
                              <p className="font-semibold">Week {report.weekNumber}</p>
                              <p className="text-sm text-slate-500 uppercase">
                                {(() => {
                                  const start = parseISO(report.startDate);
                                  const end = parseISO(report.endDate);
                                  if (!isValid(start) || !isValid(end)) return 'Unknown Date';
                                  return `${bulletinType} • ${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-bold text-xs uppercase" 
                              onClick={() => {
                                setSelectedReportId(report.id || null);
                                setActiveTab('bulletin');
                              }}
                            >
                              View
                            </Button>
                            <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50" title="Edit this report" onClick={() => {
                              setEditingReport(report);
                              setActiveTab('admin');
                            }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 shadow-none pointer-events-auto relative z-10" 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteReport(report.id!);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="mt-2">
            <AddWeekForm 
              onAdd={addReport} 
              onUpdate={updateReport}
              editingReport={editingReport}
              reports={reports}
              onCancel={() => {
                setEditingReport(null);
                setActiveTab('history');
              }}
              bulletinType={bulletinType}
              topLabel={bulletinConfig[bulletinType].topLabel}
              bottomLabel={bulletinConfig[bulletinType].bottomLabel}
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

function AddWeekForm({ 
  onAdd, 
  onUpdate,
  editingReport,
  reports,
  onCancel,
  bulletinType,
  topLabel, 
  bottomLabel,
  formData,
  setFormData 
}: { 
  onAdd: (report: Omit<WeeklyReport, 'id' | 'createdAt'>, additionalWeeklyReports?: Omit<WeeklyReport, 'id' | 'createdAt'>[]) => void,
  onUpdate: (report: WeeklyReport, additionalWeeklyReports?: Omit<WeeklyReport, 'id' | 'createdAt'>[]) => void,
  editingReport: WeeklyReport | null,
  reports: WeeklyReport[],
  onCancel: () => void,
  bulletinType: BulletinType,
  topLabel: string,
  bottomLabel: string,
  formData: any,
  setFormData: React.Dispatch<React.SetStateAction<any>>
}) {
  const isToxinBulletin = bulletinType === BulletinType.DSP || bulletinType === BulletinType.PSP || bulletinType === BulletinType.ASP || bulletinType === BulletinType.AZA_YTX;
  const [selectedWeekTab, setSelectedWeekTab] = useState<'current' | 'prev1' | 'prev2' | 'prev3'>('current');

  const loadLatestMaps = () => {
    // 1. Try to find the latest for the current category
    const latestOfType = reports
      .filter(r => r.type === bulletinType)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
    
    if (latestOfType) {
      const nextAdditional = Array(15).fill('');
      if (latestOfType.additionalMapUrls) {
        latestOfType.additionalMapUrls.forEach((url, i) => {
          if (i < 15) nextAdditional[i] = url || '';
        });
        if (bulletinType === BulletinType.FORECAST) {
          if (!nextAdditional[6] && latestOfType.additionalMapUrls[8]) nextAdditional[6] = latestOfType.additionalMapUrls[8];
          if (!nextAdditional[7] && latestOfType.additionalMapUrls[9]) nextAdditional[7] = latestOfType.additionalMapUrls[9];
          if (!nextAdditional[8] && latestOfType.additionalMapUrls[10]) nextAdditional[8] = latestOfType.additionalMapUrls[10];
          if (!nextAdditional[9] && latestOfType.additionalMapUrls[11]) nextAdditional[9] = latestOfType.additionalMapUrls[11];
        }
      }

      setFormData(prev => ({
        ...prev,
        toxinMap: latestOfType.toxinMapUrl,
        phytoMap: latestOfType.phytoMapUrl,
        additionalMaps: nextAdditional,
        mapDates: (latestOfType.mapDates && latestOfType.mapDates.length > 0) ? [...latestOfType.mapDates] : Array(15).fill(''),
        forecastDates: latestOfType.forecastDates || prev.forecastDates,
        commentary: latestOfType.commentary || '',
        kareniaStatus: latestOfType.kareniaStatus || '',
        predictionRisk: latestOfType.predictionRisk || '',
        predictionWhy: latestOfType.predictionWhy || '',
        windRoseMonth: latestOfType.windRoseMonth || '',
      }));
      toast.info(`Imported data from Week ${latestOfType.manualWeekNumber ?? latestOfType.weekNumber} (${bulletinType})`);
      return;
    }

    // 2. Fallback: Try to find the latest report regardless of category
    const anyLatest = [...reports].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
    if (anyLatest) {
      if (window.confirm(`No ${bulletinType} reports found. Reuse maps from the latest available report (Week ${anyLatest.weekNumber} - ${anyLatest.type})?`)) {
        setFormData(prev => ({
          ...prev,
          toxinMap: anyLatest.toxinMapUrl,
          phytoMap: anyLatest.phytoMapUrl,
          additionalMaps: Array(15).fill(''),
          commentary: ''
        }));
        toast.info(`Imported maps from Week ${anyLatest.weekNumber} (${anyLatest.type})`);
      }
    } else {
      toast.error('No previous reports found in system. Please upload maps manually for the first time.');
    }
  };

  // Pre-populate previous weeks' maps from existing historical reports if available
  useEffect(() => {
    if (!editingReport && isToxinBulletin) {
      const baseInfo = getWeekInfo(new Date(formData.date));
      const curWeek = formData.manualWeekNumber !== '' ? Number(formData.manualWeekNumber) : baseInfo.weekNumber;

      const repPrev1 = reports.find(r => r.type === bulletinType && (r.manualWeekNumber ?? r.weekNumber) === curWeek - 1);
      const repPrev2 = reports.find(r => r.type === bulletinType && (r.manualWeekNumber ?? r.weekNumber) === curWeek - 2);
      const repPrev3 = reports.find(r => r.type === bulletinType && (r.manualWeekNumber ?? r.weekNumber) === curWeek - 3);

      setFormData(prev => {
        const nextMaps = [...prev.additionalMaps];
        let hasChanges = false;
        if (!nextMaps[0] && repPrev1?.toxinMapUrl) { nextMaps[0] = repPrev1.toxinMapUrl; hasChanges = true; }
        if (!nextMaps[1] && repPrev1?.phytoMapUrl) { nextMaps[1] = repPrev1.phytoMapUrl; hasChanges = true; }
        if (!nextMaps[2] && repPrev2?.toxinMapUrl) { nextMaps[2] = repPrev2.toxinMapUrl; hasChanges = true; }
        if (!nextMaps[3] && repPrev2?.phytoMapUrl) { nextMaps[3] = repPrev2.phytoMapUrl; hasChanges = true; }
        if (!nextMaps[4] && repPrev3?.toxinMapUrl) { nextMaps[4] = repPrev3.toxinMapUrl; hasChanges = true; }
        if (!nextMaps[5] && repPrev3?.phytoMapUrl) { nextMaps[5] = repPrev3.phytoMapUrl; hasChanges = true; }
        return hasChanges ? { ...prev, additionalMaps: nextMaps } : prev;
      });
    }
  }, [editingReport, bulletinType, formData.date, formData.manualWeekNumber, reports]);

  useEffect(() => {
    if (editingReport) {
      const parsedDate = parseISO(editingReport.startDate);
      const additionalMaps = Array(15).fill('');
      if (editingReport.additionalMapUrls) {
        editingReport.additionalMapUrls.forEach((url, i) => {
          if (i < 15) additionalMaps[i] = url || '';
        });
        if (editingReport.type === BulletinType.FORECAST || bulletinType === BulletinType.FORECAST) {
          if (!additionalMaps[6] && editingReport.additionalMapUrls[8]) additionalMaps[6] = editingReport.additionalMapUrls[8];
          if (!additionalMaps[7] && editingReport.additionalMapUrls[9]) additionalMaps[7] = editingReport.additionalMapUrls[9];
          if (!additionalMaps[8] && editingReport.additionalMapUrls[10]) additionalMaps[8] = editingReport.additionalMapUrls[10];
          if (!additionalMaps[9] && editingReport.additionalMapUrls[11]) additionalMaps[9] = editingReport.additionalMapUrls[11];
        }
      }
      
      const mapDates = Array(15).fill('');
      if (editingReport.mapDates) {
        editingReport.mapDates.forEach((date, i) => {
          if (i < 15) mapDates[i] = date || '';
        });
      }

      setFormData({
        date: isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        manualWeekNumber: editingReport.manualWeekNumber ?? '',
        manualDateRange: editingReport.manualDateRange ?? '',
        toxinMap: editingReport.toxinMapUrl,
        phytoMap: editingReport.phytoMapUrl,
        additionalMaps: additionalMaps,
        mapDates: mapDates,
        forecastDates: (editingReport.forecastDates && editingReport.forecastDates.some(d => d && d.trim() !== ''))
          ? editingReport.forecastDates
          : [
              format(addDays(isValid(parsedDate) ? parsedDate : new Date(), 1), 'yyyy-MM-dd'),
              format(addDays(isValid(parsedDate) ? parsedDate : new Date(), 2), 'yyyy-MM-dd'),
              format(addDays(isValid(parsedDate) ? parsedDate : new Date(), 3), 'yyyy-MM-dd')
            ],
        biotoxinReport: editingReport.biotoxinReport || '',
        biotoxins: editingReport.biotoxins || { asp: '', aza: '', dsp: '', psp: '', ytx: '' },
        harmfulAlgaeReport: editingReport.harmfulAlgaeReport || '',
        harmfulAlgae: editingReport.harmfulAlgae || { alexandrium: '', dinophysis: '', karenia: '', prorocentrum: '', pseudoDelicatissima: '', pseudoSeriata: '' },
        trendsForecast: editingReport.trendsForecast || '',
        trends: editingReport.trends || {
          alexandriumPsp: '',
          dinophysisDsp: '',
          pseudoNitzschiaAsp: '',
          azaYtx: '',
          riskPsp: '',
          riskDsp: '',
          riskAsp: '',
          riskYtx: '',
          riskAza: ''
        },
        commentary: editingReport.commentary || '',
        kareniaStatus: editingReport.kareniaStatus || '',
        predictionRisk: editingReport.predictionRisk || '',
        predictionWhy: editingReport.predictionWhy || '',
        windRoseMonth: editingReport.windRoseMonth || '',
      });
    }
  }, [editingReport]);

  const setMapDate = (index: number, dateStr: string) => {
    setFormData(prev => {
      const next = [...prev.mapDates];
      next[index] = dateStr;
      return { ...prev, mapDates: next };
    });
  };

  const removeMap = (e: React.MouseEvent, field: 'toxinMap' | 'phytoMap' | number) => {
    e.stopPropagation();
    if (typeof field === 'number') {
      setFormData(prev => {
        const next = [...prev.additionalMaps];
        next[field] = '';
        return { ...prev, additionalMaps: next };
      });
    } else {
      setFormData(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'toxinMap' | 'phytoMap' | number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Allow up to 5MB before compression
        toast.error('File is too large. Please upload an image smaller than 5MB.');
        return;
      }

      const reader = new FileReader();
      const fieldId = typeof field === 'number' ? `additional-${field}` : field;
      
      reader.onloadstart = () => {
        toast.loading('Processing image...', { id: `upload-${fieldId}` });
      };
      reader.onloadend = async () => {
        try {
          const rawResult = reader.result as string;
          // Apply automatic compression to keep storage efficient
          const compressed = await compressImage(rawResult, 1200, 0.7);
          
          if (typeof field === 'number') {
            setFormData(prev => {
              const next = [...prev.additionalMaps];
              next[field] = compressed;
              return { ...prev, additionalMaps: next };
            });
          } else {
            setFormData(prev => ({ ...prev, [field]: compressed }));
          }
          toast.dismiss(`upload-${fieldId}`);
          toast.success('Image optimized and uploaded');
        } catch (err) {
          console.error('Compression error:', err);
          toast.dismiss(`upload-${fieldId}`);
          toast.error('Failed to process image');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulletinType === BulletinType.FORECAST) {
      const hasAnyForecastMap = !!formData.toxinMap || !!formData.phytoMap || formData.additionalMaps.some((m: string) => !!m);
      if (!hasAnyForecastMap) {
        toast.error('Please upload at least one forecast map');
        return;
      }
    } else if (bulletinType === BulletinType.ANALYSIS) {
      // Analysis requires text fields only
    } else if (isToxinBulletin) {
      if (!formData.toxinMap && !formData.phytoMap) {
        toast.error('Please upload at least the current week\'s toxin or phytoplankton map');
        return;
      }
    } else {
      // Environmental (SST, SSC, Karenia, Chlorophyll, Wind Rose, Summary)
      const hasAnyMap = !!formData.toxinMap || !!formData.phytoMap || formData.additionalMaps.some((m: string) => !!m);
      if (!hasAnyMap) {
        toast.error('Please upload at least one map');
        return;
      }
    }

    const manualWeek = formData.manualWeekNumber !== '' ? Number(formData.manualWeekNumber) : undefined;
    const info = getWeekInfo(new Date(formData.date));
    const effectiveWeek = manualWeek !== undefined ? manualWeek : info.weekNumber;
    
    let startDate = info.startDate;
    let endDate = info.endDate;
    if (manualWeek !== undefined && manualWeek !== info.weekNumber) {
      const weekDiff = manualWeek - info.weekNumber;
      const adjustedStart = addWeeks(parseISO(info.startDate), weekDiff);
      startDate = adjustedStart.toISOString();
      endDate = endOfWeek(adjustedStart, { weekStartsOn: 1 }).toISOString();
    }
    
    const baseReportDate = formData.date ? parseISO(formData.date) : new Date();
    const validBaseDate = isValid(baseReportDate) ? baseReportDate : new Date();
    const effectiveForecastDates = bulletinType === BulletinType.FORECAST ? [
      formData.forecastDates?.[0] && formData.forecastDates[0].trim() !== '' 
        ? formData.forecastDates[0].trim() 
        : format(addDays(validBaseDate, 1), 'yyyy-MM-dd'),
      formData.forecastDates?.[1] && formData.forecastDates[1].trim() !== '' 
        ? formData.forecastDates[1].trim() 
        : format(addDays(validBaseDate, 2), 'yyyy-MM-dd'),
      formData.forecastDates?.[2] && formData.forecastDates[2].trim() !== '' 
        ? formData.forecastDates[2].trim() 
        : format(addDays(validBaseDate, 3), 'yyyy-MM-dd'),
    ] : formData.forecastDates;

    const reportData = {
      type: bulletinType,
      weekNumber: effectiveWeek,
      startDate: startDate,
      endDate: endDate,
      targetDate: formData.date,
      manualWeekNumber: manualWeek,
      manualDateRange: formData.manualDateRange || undefined,
      toxinMapUrl: formData.toxinMap || '',
      phytoMapUrl: formData.phytoMap || '',
      additionalMapUrls: formData.additionalMaps.map((url: string) => url || ''),
      mapDates: formData.mapDates,
      forecastDates: effectiveForecastDates,
      biotoxinReport: formData.biotoxinReport,
      biotoxins: formData.biotoxins,
      harmfulAlgaeReport: formData.harmfulAlgaeReport,
      harmfulAlgae: formData.harmfulAlgae,
      trendsForecast: formData.trendsForecast,
      trends: formData.trends,
      commentary: formData.commentary,
      kareniaStatus: formData.kareniaStatus,
      predictionRisk: formData.predictionRisk,
      predictionWhy: formData.predictionWhy,
      windRoseMonth: formData.windRoseMonth,
    };

    const additionalWeeklyReports: Omit<WeeklyReport, 'id' | 'createdAt'>[] = [];
    if (isToxinBulletin) {
      // Week N-1
      if (formData.additionalMaps[0] || formData.additionalMaps[1]) {
        const prev1Date = subWeeks(parseISO(startDate), 1);
        additionalWeeklyReports.push({
          type: bulletinType,
          weekNumber: effectiveWeek - 1,
          manualWeekNumber: effectiveWeek - 1,
          startDate: prev1Date.toISOString(),
          endDate: endOfWeek(prev1Date, { weekStartsOn: 1 }).toISOString(),
          targetDate: prev1Date.toISOString(),
          toxinMapUrl: formData.additionalMaps[0] || '',
          phytoMapUrl: formData.additionalMaps[1] || '',
          additionalMapUrls: []
        });
      }
      // Week N-2
      if (formData.additionalMaps[2] || formData.additionalMaps[3]) {
        const prev2Date = subWeeks(parseISO(startDate), 2);
        additionalWeeklyReports.push({
          type: bulletinType,
          weekNumber: effectiveWeek - 2,
          manualWeekNumber: effectiveWeek - 2,
          startDate: prev2Date.toISOString(),
          endDate: endOfWeek(prev2Date, { weekStartsOn: 1 }).toISOString(),
          targetDate: prev2Date.toISOString(),
          toxinMapUrl: formData.additionalMaps[2] || '',
          phytoMapUrl: formData.additionalMaps[3] || '',
          additionalMapUrls: []
        });
      }
      // Week N-3
      if (formData.additionalMaps[4] || formData.additionalMaps[5]) {
        const prev3Date = subWeeks(parseISO(startDate), 3);
        additionalWeeklyReports.push({
          type: bulletinType,
          weekNumber: effectiveWeek - 3,
          manualWeekNumber: effectiveWeek - 3,
          startDate: prev3Date.toISOString(),
          endDate: endOfWeek(prev3Date, { weekStartsOn: 1 }).toISOString(),
          targetDate: prev3Date.toISOString(),
          toxinMapUrl: formData.additionalMaps[4] || '',
          phytoMapUrl: formData.additionalMaps[5] || '',
          additionalMapUrls: []
        });
      }
    }

    if (editingReport) {
      onUpdate({ ...editingReport, ...reportData }, additionalWeeklyReports);
    } else {
      onAdd(reportData, additionalWeeklyReports);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-md border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>{editingReport ? 'Edit Weekly Report' : 'Add New Weekly Report'}</CardTitle>
          {!editingReport && (
            <p className="text-xs text-slate-500 uppercase font-semibold">Creating {bulletinType} Report</p>
          )}
        </div>
        <div className="flex gap-2">
          {!editingReport && (
            <Button variant="outline" size="sm" onClick={loadLatestMaps} type="button">
              <History className="w-4 h-4 mr-2" />
              Reuse Latest Maps
            </Button>
          )}
          {editingReport && (
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel Edit</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="date">Reporting Date (Any day in the target week)</Label>
            <Input 
              id="date" 
              type="date" 
              value={formData.date} 
              onChange={(e) => {
                const newDate = e.target.value;
                setFormData(prev => {
                  const base = newDate ? parseISO(newDate) : new Date();
                  const validBase = isValid(base) ? base : new Date();
                  return {
                    ...prev,
                    date: newDate,
                    forecastDates: [
                      format(addDays(validBase, 1), 'yyyy-MM-dd'),
                      format(addDays(validBase, 2), 'yyyy-MM-dd'),
                      format(addDays(validBase, 3), 'yyyy-MM-dd')
                    ]
                  };
                });
              }}
              required 
            />
            <p className="text-xs text-slate-500">The system will automatically calculate the week number and range (Mon-Sun).</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="manualWeekNumber">Custom Week Number (Optional)</Label>
              <Input 
                id="manualWeekNumber" 
                type="number" 
                placeholder={`Auto: ${getWeekInfo(new Date(formData.date)).weekNumber}`}
                value={formData.manualWeekNumber} 
                onChange={(e) => setFormData(prev => ({ ...prev, manualWeekNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualDateRange">Custom Date Range (Optional)</Label>
              <Input 
                id="manualDateRange" 
                placeholder={`Auto: ${formatBulletinDateRange(getWeekInfo(new Date(formData.date)).startDate, getWeekInfo(new Date(formData.date)).endDate)}`}
                value={formData.manualDateRange} 
                onChange={(e) => setFormData(prev => ({ ...prev, manualDateRange: e.target.value }))}
                className="bg-white"
              />
            </div>
          </div>

          {isToxinBulletin && (
            /* 4-Week Timeline Map Uploads for DSP, PSP, ASP, AZA_YTX */
            <div className="space-y-4 border border-blue-200/90 rounded-xl p-4 bg-blue-50/25">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 border-b border-blue-200/60 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                    <LayoutDashboard className="w-4 h-4 text-blue-700" />
                    4-Week Timeline Map Uploads ({bulletinType})
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    The {bulletinType} bulletin page displays 4 consecutive weeks. Switch tabs below to populate all 4 weeks at once.
                  </p>
                </div>
              </div>

              {/* 4 Week Tabs */}
              {(() => {
                const baseInfo = getWeekInfo(new Date(formData.date));
                const effWeek = formData.manualWeekNumber !== '' ? Number(formData.manualWeekNumber) : baseInfo.weekNumber;
                
                const tabs = [
                  { 
                    key: 'current', 
                    title: `Week ${effWeek}`, 
                    sub: 'Current Bulletin', 
                    tField: 'toxinMap' as const, 
                    pField: 'phytoMap' as const, 
                    tMap: formData.toxinMap, 
                    pMap: formData.phytoMap 
                  },
                  { 
                    key: 'prev1', 
                    title: `Week ${effWeek - 1}`, 
                    sub: '1 Week Prior', 
                    tField: 0, 
                    pField: 1, 
                    tMap: formData.additionalMaps[0], 
                    pMap: formData.additionalMaps[1] 
                  },
                  { 
                    key: 'prev2', 
                    title: `Week ${effWeek - 2}`, 
                    sub: '2 Weeks Prior', 
                    tField: 2, 
                    pField: 3, 
                    tMap: formData.additionalMaps[2], 
                    pMap: formData.additionalMaps[3] 
                  },
                  { 
                    key: 'prev3', 
                    title: `Week ${effWeek - 3}`, 
                    sub: '3 Weeks Prior', 
                    tField: 4, 
                    pField: 5, 
                    tMap: formData.additionalMaps[4], 
                    pMap: formData.additionalMaps[5] 
                  },
                ];

                const currentActive = tabs.find(t => t.key === selectedWeekTab) || tabs[0];

                return (
                  <div className="space-y-4">
                    {/* Tab Navigation */}
                    <div className="grid grid-cols-4 gap-2 bg-slate-200/70 p-1.5 rounded-lg">
                      {tabs.map((tab) => {
                        const count = (tab.tMap ? 1 : 0) + (tab.pMap ? 1 : 0);
                        const isSelected = selectedWeekTab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setSelectedWeekTab(tab.key as any)}
                            className={`py-2 px-1 text-center rounded-md text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                              isSelected 
                                ? 'bg-white text-blue-900 shadow-sm border border-slate-200/80 ring-1 ring-blue-500/20' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                            }`}
                          >
                            <span className="leading-tight">{tab.title}</span>
                            <span className="text-[9px] font-medium text-slate-500">{tab.sub}</span>
                            <span className="mt-0.5 text-[8px] font-bold">
                              {count === 2 ? (
                                <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">✓ 2 Maps</span>
                              ) : count === 1 ? (
                                <span className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded">◐ 1 Map</span>
                              ) : (
                                <span className="text-slate-400">○ Empty</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Week Uploader */}
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <span className="text-xs font-bold text-slate-800">
                            {currentActive.title} ({currentActive.sub})
                          </span>
                          <span className="text-[10px] text-slate-500 ml-2">
                            Row 1: Toxin Map • Row 2: Phytoplankton Map
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Toxin Map Slot */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>Toxin Map ({topLabel})</span>
                            <span className="text-[10px] text-slate-500 font-semibold">{currentActive.title}</span>
                          </Label>
                          <div 
                            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors relative min-h-[160px] flex flex-col items-center justify-center gap-2 ${
                              currentActive.tMap ? 'border-green-500 bg-green-50/20' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                            }`}
                          >
                            <input 
                              id={`toxin-input-${currentActive.key}`}
                              type="file" 
                              accept="image/*" 
                              className="hidden"
                              onChange={(e) => handleFileChange(e, currentActive.tField)}
                            />
                            {currentActive.tMap ? (
                              <div className="relative group w-full h-full min-h-[120px]">
                                <div 
                                  className="cursor-pointer"
                                  onClick={() => document.getElementById(`toxin-input-${currentActive.key}`)?.click()}
                                >
                                  <img src={currentActive.tMap} className="h-32 mx-auto object-contain rounded shadow-sm" alt="Preview" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                    <p className="text-white text-xs font-bold">Click to Change</p>
                                  </div>
                                </div>
                                <Button 
                                  type="button" 
                                  variant="destructive" 
                                  size="icon" 
                                  className="absolute -top-3 -right-3 h-7 w-7 rounded-full shadow-lg z-50 pointer-events-auto"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeMap(e, currentActive.tField);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer py-3"
                                onClick={() => document.getElementById(`toxin-input-${currentActive.key}`)?.click()}
                              >
                                <Plus className="w-8 h-8 text-slate-400" />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">Click to upload {currentActive.title} Toxin Map</p>
                                  <p className="text-xs text-slate-400">Max size: 5MB</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Phyto Map Slot */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>Phytoplankton Map ({bottomLabel})</span>
                            <span className="text-[10px] text-slate-500 font-semibold">{currentActive.title}</span>
                          </Label>
                          <div 
                            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors relative min-h-[160px] flex flex-col items-center justify-center gap-2 ${
                              currentActive.pMap ? 'border-green-500 bg-green-50/20' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                            }`}
                          >
                            <input 
                              id={`phyto-input-${currentActive.key}`}
                              type="file" 
                              accept="image/*" 
                              className="hidden"
                              onChange={(e) => handleFileChange(e, currentActive.pField)}
                            />
                            {currentActive.pMap ? (
                              <div className="relative group w-full h-full min-h-[120px]">
                                <div 
                                  className="cursor-pointer"
                                  onClick={() => document.getElementById(`phyto-input-${currentActive.key}`)?.click()}
                                >
                                  <img src={currentActive.pMap} className="h-32 mx-auto object-contain rounded shadow-sm" alt="Preview" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                    <p className="text-white text-xs font-bold">Click to Change</p>
                                  </div>
                                </div>
                                <Button 
                                  type="button" 
                                  variant="destructive" 
                                  size="icon" 
                                  className="absolute -top-3 -right-3 h-7 w-7 rounded-full shadow-lg z-50 pointer-events-auto"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeMap(e, currentActive.pField);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer py-3"
                                onClick={() => document.getElementById(`phyto-input-${currentActive.key}`)?.click()}
                              >
                                <Plus className="w-8 h-8 text-slate-400" />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">Click to upload {currentActive.title} Phyto Map</p>
                                  <p className="text-xs text-slate-400">Max size: 5MB</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick 4-Week Preview Strip */}
                    <div className="p-2.5 bg-slate-100/80 border border-slate-200/90 rounded-lg">
                      <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[11px] font-bold text-slate-700">
                          {bulletinType} 4-Week Timeline Overview:
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Click any week below to edit its maps
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {tabs.slice().reverse().map((tab) => (
                          <div 
                            key={`strip-${tab.key}`}
                            onClick={() => setSelectedWeekTab(tab.key as any)}
                            className={`p-2 rounded border text-center cursor-pointer transition-all ${
                              selectedWeekTab === tab.key 
                                ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-400/30' 
                                : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="text-[10px] font-bold block text-slate-800">{tab.title}</span>
                            <span className="text-[8px] text-slate-400 block mb-1">{tab.sub}</span>
                            <div className="flex gap-1.5 justify-center">
                              <div className="w-8 h-10 border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden rounded-xs">
                                {tab.tMap ? (
                                  <img src={tab.tMap} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[6px] text-slate-400 font-bold uppercase leading-tight">Toxin TBD</span>
                                )}
                              </div>
                              <div className="w-8 h-10 border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden rounded-xs">
                                {tab.pMap ? (
                                  <img src={tab.pMap} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[6px] text-slate-400 font-bold uppercase leading-tight">Phyto TBD</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {!isToxinBulletin && (
            bulletinType === BulletinType.FORECAST ? (
              /* DEDICATED FORECAST 3-ROW BUILDER */
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-blue-50/80 border border-blue-200 rounded-lg p-3.5">
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Wind and Rain 3-Day Forecast Maps & Row Dates
                    </h4>
                    <p className="text-xs text-blue-700">
                      Upload maps for all 4 time slots (6 AM, 12 Noon, 6 PM, 12 PM) across Day 1, Day 2, and Day 3.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 bg-white hover:bg-slate-100 border-blue-300 text-blue-800"
                    onClick={() => {
                      const base = formData.date ? parseISO(formData.date) : new Date();
                      const validBase = isValid(base) ? base : new Date();
                      setFormData(prev => ({
                        ...prev,
                        forecastDates: [
                          format(addDays(validBase, 1), 'yyyy-MM-dd'),
                          format(addDays(validBase, 2), 'yyyy-MM-dd'),
                          format(addDays(validBase, 3), 'yyyy-MM-dd')
                        ]
                      }));
                      toast.info('Auto-filled 3 forecast row dates (+1, +2, +3 days)');
                    }}
                  >
                    Auto-Set Dates (+1, +2, +3)
                  </Button>
                </div>

                {[0, 1, 2].map((rowIdx) => {
                  const base = formData.date ? parseISO(formData.date) : new Date();
                  const validBase = isValid(base) ? base : new Date();
                  const defaultDate = format(addDays(validBase, rowIdx + 1), 'yyyy-MM-dd');
                  const currentDate = formData.forecastDates?.[rowIdx] || defaultDate;
                  const previewText = isValid(parseISO(currentDate)) ? format(parseISO(currentDate), 'd MMM yyyy') : currentDate;

                  const slots = rowIdx === 0
                    ? [
                        { label: 'Row 1 • 6 AM Map', time: '6 AM', field: 'toxinMap' as const, value: formData.toxinMap, id: 'fc-r1-6am' },
                        { label: 'Row 1 • 12 Noon Map', time: '12 Noon', field: 'phytoMap' as const, value: formData.phytoMap, id: 'fc-r1-12noon' },
                        { label: 'Row 1 • 6 PM Map', time: '6 PM', field: 0, value: formData.additionalMaps[0], id: 'fc-r1-6pm' },
                        { label: 'Row 1 • 12 PM Map', time: '12 PM', field: 1, value: formData.additionalMaps[1], id: 'fc-r1-12pm' },
                      ]
                    : rowIdx === 1
                    ? [
                        { label: 'Row 2 • 6 AM Map', time: '6 AM', field: 2, value: formData.additionalMaps[2], id: 'fc-r2-6am' },
                        { label: 'Row 2 • 12 Noon Map', time: '12 Noon', field: 3, value: formData.additionalMaps[3], id: 'fc-r2-12noon' },
                        { label: 'Row 2 • 6 PM Map', time: '6 PM', field: 4, value: formData.additionalMaps[4], id: 'fc-r2-6pm' },
                        { label: 'Row 2 • 12 PM Map', time: '12 PM', field: 5, value: formData.additionalMaps[5], id: 'fc-r2-12pm' },
                      ]
                    : [
                        { label: 'Row 3 • 6 AM Map', time: '6 AM', field: 6, value: formData.additionalMaps[6], id: 'fc-r3-6am' },
                        { label: 'Row 3 • 12 Noon Map', time: '12 Noon', field: 7, value: formData.additionalMaps[7], id: 'fc-r3-12noon' },
                        { label: 'Row 3 • 6 PM Map', time: '6 PM', field: 8, value: formData.additionalMaps[8], id: 'fc-r3-6pm' },
                        { label: 'Row 3 • 12 PM Map', time: '12 PM', field: 9, value: formData.additionalMaps[9], id: 'fc-r3-12pm' },
                      ];

                  return (
                    <div key={rowIdx} className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-600 text-white font-bold text-xs px-2.5 py-0.5 rounded shadow-xs">
                            Row {rowIdx + 1}
                          </span>
                          <span className="text-sm font-bold text-slate-800">
                            Day {rowIdx + 1}
                          </span>
                          <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                            {previewText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                            Row {rowIdx + 1} Date:
                          </Label>
                          <Input
                            type="date"
                            className="h-8 text-xs w-40 bg-slate-50 border-slate-300 font-medium"
                            value={currentDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => {
                                const next = [...(prev.forecastDates || [
                                  format(addDays(validBase, 1), 'yyyy-MM-dd'),
                                  format(addDays(validBase, 2), 'yyyy-MM-dd'),
                                  format(addDays(validBase, 3), 'yyyy-MM-dd')
                                ])];
                                next[rowIdx] = val;
                                return { ...prev, forecastDates: next };
                              });
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                        {slots.map((slot) => (
                          <div key={slot.id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                                {slot.time}
                              </span>
                              {slot.value && (
                                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                  <Check className="w-2.5 h-2.5" /> Added
                                </span>
                              )}
                            </div>
                            <div
                              className={`border-2 border-dashed rounded-lg p-2.5 text-center transition-colors relative min-h-[140px] flex flex-col items-center justify-center gap-1.5 ${
                                slot.value ? 'border-green-500 bg-green-50/20' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                id={slot.id}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleFileChange(e, slot.field)}
                              />
                              {slot.value ? (
                                <div className="relative group w-full h-full min-h-[110px] flex items-center justify-center">
                                  <div
                                    className="cursor-pointer"
                                    onClick={() => document.getElementById(slot.id)?.click()}
                                  >
                                    <img src={slot.value} className="h-28 mx-auto object-contain rounded shadow-sm" alt="Preview" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                      <p className="text-white text-[11px] font-bold">Click to Change</p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md z-50 pointer-events-auto"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      removeMap(e, slot.field);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className="w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer py-2"
                                  onClick={() => document.getElementById(slot.id)?.click()}
                                >
                                  <Plus className="w-6 h-6 text-slate-400" />
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-slate-700">Upload {slot.time}</p>
                                    <p className="text-[10px] text-slate-400">Row {rowIdx + 1}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* OTHER NON-TOXIN BULLETINS (SST, SSC, Karenia, Chlorophyll, Wind Rose, Summary) */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Map 1 */}
                  <div className="space-y-4">
                    <Label htmlFor="toxinMap">
                      {bulletinType === BulletinType.WIND_ROSE ? 'Week 13 Wind Rose' : 
                       bulletinType === BulletinType.SUMMARY ? '1. Alexandrium Gauge (Circle)' :
                       (bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.KARENIA || bulletinType === BulletinType.CHLOROPHYLL) ? 'Map 1' : `Map 1 (${topLabel})`}
                    </Label>
                    <div 
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors relative min-h-[160px] flex flex-col items-center justify-center gap-2 ${formData.toxinMap ? 'border-green-500 bg-[#f0fdf41a]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                    >
                      <input 
                        id="toxinMap" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleFileChange(e, 'toxinMap')}
                      />
                      {formData.toxinMap ? (
                        <div className="relative group w-full h-full min-h-[120px]">
                          <div 
                            className="cursor-pointer"
                            onClick={() => document.getElementById('toxinMap')?.click()}
                          >
                            <img src={formData.toxinMap} className="h-32 mx-auto object-contain rounded shadow-sm" alt="Preview" />
                            <div className="absolute inset-0 bg-[#00000066] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                              <p className="text-white text-xs font-bold">Click to Change</p>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="icon" 
                            className="absolute -top-3 -right-3 h-7 w-7 rounded-full shadow-lg z-50 pointer-events-auto"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeMap(e, 'toxinMap');
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer"
                          onClick={() => document.getElementById('toxinMap')?.click()}
                        >
                          <Plus className="w-8 h-8 text-slate-400" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Click to upload {bulletinType === BulletinType.SUMMARY ? '1. Alexandrium Gauge (Circle)' : 'Map 1'}</p>
                            <p className="text-xs text-slate-400">Max size: 5MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {(bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.CHLOROPHYLL) && (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase">Map 1 Date</Label>
                        <Input 
                          type="date" 
                          className="h-8 text-xs" 
                          value={formData.mapDates[0] || (formData.date && isValid(new Date(formData.date)) ? format(new Date(formData.date), 'yyyy-MM-dd') : '')} 
                          onChange={(e) => setMapDate(0, e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Map 2 */}
                  <div className="space-y-4">
                    <Label htmlFor="phytoMap">
                      {bulletinType === BulletinType.WIND_ROSE ? 'Week 14 Wind Rose' : 
                       bulletinType === BulletinType.SUMMARY ? '2. Dinophysis Gauge (Circle)' :
                       (bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.KARENIA || bulletinType === BulletinType.CHLOROPHYLL) ? 'Map 2' : `Map 2 (${bottomLabel})`}
                    </Label>
                    <div 
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors relative min-h-[160px] flex flex-col items-center justify-center gap-2 ${formData.phytoMap ? 'border-green-500 bg-[#f0fdf41a]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                    >
                      <input 
                        id="phytoMap" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleFileChange(e, 'phytoMap')}
                      />
                      {formData.phytoMap ? (
                        <div className="relative group w-full h-full min-h-[120px]">
                          <div 
                            className="cursor-pointer"
                            onClick={() => document.getElementById('phytoMap')?.click()}
                          >
                            <img src={formData.phytoMap} className="h-32 mx-auto object-contain rounded shadow-sm" alt="Preview" />
                            <div className="absolute inset-0 bg-[#00000066] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                              <p className="text-white text-xs font-bold">Click to Change</p>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="icon" 
                            className="absolute -top-3 -right-3 h-7 w-7 rounded-full shadow-lg z-50 pointer-events-auto"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeMap(e, 'phytoMap');
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer"
                          onClick={() => document.getElementById('phytoMap')?.click()}
                        >
                          <Plus className="w-8 h-8 text-slate-400" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Click to upload {bulletinType === BulletinType.SUMMARY ? '2. Dinophysis Gauge (Circle)' : 'Map 2'}</p>
                            <p className="text-xs text-slate-400">Max size: 5MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {(bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.CHLOROPHYLL) && (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase">Map 2 Date</Label>
                        <Input 
                          type="date" 
                          className="h-8 text-xs" 
                          value={formData.mapDates[1] || (formData.date && isValid(new Date(formData.date)) ? (bulletinType === BulletinType.SSC ? format(addDays(new Date(formData.date), 8), 'yyyy-MM-dd') : format(addDays(new Date(formData.date), 1), 'yyyy-MM-dd')) : '')} 
                          onChange={(e) => setMapDate(1, e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Dynamic additional slots */}
                  {(bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.KARENIA || bulletinType === BulletinType.CHLOROPHYLL || bulletinType === BulletinType.WIND_ROSE || bulletinType === BulletinType.SUMMARY) && Array.from({ length: (bulletinType === BulletinType.SST || bulletinType === BulletinType.CHLOROPHYLL) ? 4 : (bulletinType === BulletinType.WIND_ROSE ? 3 : (bulletinType === BulletinType.SUMMARY ? 8 : 2)) }).map((_, i) => {
                    const label = bulletinType === BulletinType.WIND_ROSE 
                      ? (i === 0 ? 'Week 15 Wind Rose' : i === 1 ? 'Week 16 Wind Rose (Current)' : 'Monthly Summary Map (Bottom Left)') 
                      : bulletinType === BulletinType.SUMMARY
                        ? [
                            '3. Pseudo-nitzschia deli Gauge (Circle)',
                            '4. Pseudo-nitzschia seri Gauge (Circle)',
                            '5. Prorocentrum lima Gauge (Circle)',
                            '6. PSP Gauge (Circle)',
                            '7. DSP Gauge (Circle)',
                            '8. ASP Gauge (Circle)',
                            '9. YTXs Gauge (Circle)',
                            '10. AZAs Gauge (Circle)'
                          ][i]
                        : `Map ${i + 3}`;
                    
                    return (
                      <div key={`additional-${i}`} className="space-y-4">
                        <Label htmlFor={`map-slot-${i}`}>{label}</Label>
                        <div 
                          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors relative min-h-[160px] flex flex-col items-center justify-center gap-2 ${formData.additionalMaps[i] ? 'border-green-500 bg-[#f0fdf41a]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                        >
                          <input 
                            id={`map-slot-${i}`} 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileChange(e, i)}
                          />
                          {formData.additionalMaps[i] ? (
                            <div className="relative group w-full h-full min-h-[120px]">
                              <div 
                                className="cursor-pointer"
                                onClick={() => document.getElementById(`map-slot-${i}`)?.click()}
                              >
                                <img src={formData.additionalMaps[i]} className="h-32 mx-auto object-contain rounded shadow-sm" alt="Preview" />
                                <div className="absolute inset-0 bg-[#00000066] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                  <p className="text-white text-xs font-bold">Click to Change</p>
                                </div>
                              </div>
                              <Button 
                                type="button" 
                                variant="destructive" 
                                size="icon" 
                                className="absolute -top-3 -right-3 h-7 w-7 rounded-full shadow-lg z-50 pointer-events-auto"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeMap(e, i);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer"
                              onClick={() => document.getElementById(`map-slot-${i}`)?.click()}
                            >
                              <Plus className="w-8 h-8 text-slate-400" />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Click to upload {label}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {(bulletinType === BulletinType.SST || bulletinType === BulletinType.SSC || bulletinType === BulletinType.CHLOROPHYLL) && (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-slate-500 uppercase">{`Map ${i + 3} Date`}</Label>
                            <Input 
                              type="date" 
                              className="h-8 text-xs" 
                              value={formData.mapDates[i + 2] || (formData.date && isValid(new Date(formData.date)) ? (bulletinType === BulletinType.SSC ? format(addDays(new Date(formData.date), i + 9), 'yyyy-MM-dd') : format(addDays(new Date(formData.date), i + 2), 'yyyy-MM-dd')) : '')} 
                              onChange={(e) => setMapDate(i + 2, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {bulletinType === BulletinType.ANALYSIS ? (
            <div className="space-y-8 pt-4 border-t border-slate-100">
              {/* Memory Retention & Quick Actions Banner */}
              <div className="bg-blue-50/90 border border-blue-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-blue-100 rounded-md text-blue-700 mt-0.5 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-950 uppercase tracking-tight flex items-center gap-1.5">
                      Analysis Text Kept In Memory
                      <span className="text-[9px] bg-green-100 text-green-800 font-extrabold px-1.5 py-0.2 rounded border border-green-300">
                        Autosaved
                      </span>
                    </h4>
                    <p className="text-[11px] text-blue-800">
                      All written analysis text stays preserved in memory as you type and persists across tabs.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-bold bg-white border-blue-200 text-blue-800 hover:bg-blue-100/60"
                    onClick={() => {
                      const latestAnalysis = reports
                        .filter(r => r.type === BulletinType.ANALYSIS)
                        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
                      if (latestAnalysis) {
                        setFormData(prev => ({
                          ...prev,
                          biotoxinReport: latestAnalysis.biotoxinReport || '',
                          biotoxins: latestAnalysis.biotoxins || { asp: '', aza: '', dsp: '', psp: '', ytx: '' },
                          harmfulAlgaeReport: latestAnalysis.harmfulAlgaeReport || '',
                          harmfulAlgae: latestAnalysis.harmfulAlgae || { alexandrium: '', dinophysis: '', karenia: '', prorocentrum: '', pseudoDelicatissima: '', pseudoSeriata: '' },
                          trendsForecast: latestAnalysis.trendsForecast || '',
                          trends: latestAnalysis.trends || {
                            alexandriumPsp: '',
                            dinophysisDsp: '',
                            pseudoNitzschiaAsp: '',
                            azaYtx: '',
                            riskPsp: '',
                            riskDsp: '',
                            riskAsp: '',
                            riskYtx: '',
                            riskAza: ''
                          }
                        }));
                        toast.info(`Loaded text from published Analysis report (Week ${latestAnalysis.manualWeekNumber ?? latestAnalysis.weekNumber})`);
                      } else {
                        toast.error('No published Analysis report found to load.');
                      }
                    }}
                  >
                    <BookOpen className="w-3 h-3 mr-1" />
                    Load Latest Report
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-bold bg-white border-blue-200 text-blue-800 hover:bg-blue-100/60"
                    onClick={() => {
                      if (window.confirm('Reset all analysis text back to standard baseline template?')) {
                        setFormData(prev => ({
                          ...prev,
                          biotoxinReport: DEFAULT_ANALYSIS_TEXT.biotoxinReport,
                          biotoxins: { ...DEFAULT_ANALYSIS_TEXT.biotoxins },
                          harmfulAlgaeReport: DEFAULT_ANALYSIS_TEXT.harmfulAlgaeReport,
                          harmfulAlgae: { ...DEFAULT_ANALYSIS_TEXT.harmfulAlgae },
                          trendsForecast: DEFAULT_ANALYSIS_TEXT.trendsForecast,
                          trends: { ...DEFAULT_ANALYSIS_TEXT.trends }
                        }));
                        toast.info('Reset to standard baseline analysis template');
                      }
                    }}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Standard Baseline
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-bold bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                    onClick={() => {
                      if (window.confirm('Clear all analysis text fields?')) {
                        setFormData(prev => ({
                          ...prev,
                          biotoxinReport: '',
                          biotoxins: { asp: '', aza: '', dsp: '', psp: '', ytx: '' },
                          harmfulAlgaeReport: '',
                          harmfulAlgae: { alexandrium: '', dinophysis: '', karenia: '', prorocentrum: '', pseudoDelicatissima: '', pseudoSeriata: '' },
                          trendsForecast: '',
                          trends: {
                            alexandriumPsp: '',
                            dinophysisDsp: '',
                            pseudoNitzschiaAsp: '',
                            azaYtx: '',
                            riskPsp: '',
                            riskDsp: '',
                            riskAsp: '',
                            riskYtx: '',
                            riskAza: ''
                          }
                        }));
                        toast.info('Cleared all analysis text fields');
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Biotoxin Report Section */}
              <div id="analysis-section-biotoxin" className="space-y-4 bg-[#fdf3da]/40 p-5 border border-[#d4a017]/30 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#d4a017]/30 pb-2">
                  <div>
                    <Label className="text-base font-black text-[#1e3a8a] uppercase tracking-tight block">Biotoxin report</Label>
                    <p className="text-[11px] text-slate-600">Enter data for individual toxins. Boxes automatically resize to accommodate unlimited text.</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded border border-[#f59e0b]/40 w-fit">
                    Auto-resizing boxes
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {[
                     { label: 'ASP toxins', key: 'asp', presets: ['Not detected (< 1.0 mg/kg)', 'Below statutory limit', 'Trace levels recorded'] },
                     { label: 'AZA toxins', key: 'aza', presets: ['Not detected or below LOQ', 'Well below statutory limit (160 µg/kg)', 'Trace detections'] },
                     { label: 'DSP toxins', key: 'dsp', presets: ['Not detected or below LOQ', 'Below 160 µg/kg statutory limit', 'Trace levels in sheltered voes'] },
                     { label: 'PSP toxins', key: 'psp', presets: ['Below LOQ across all sites', 'Not detected (< 100 µg/kg)', 'Zero toxicity detected'] },
                     { label: 'YTX toxins', key: 'ytx', presets: ['Not detected (< 0.1 mg/kg)', 'Well below 3.75 mg/kg threshold', 'Trace concentrations'] }
                   ].map((item) => (
                     <div key={item.key} className="space-y-1.5 bg-white p-3 rounded-md border border-[#d4a017]/25 shadow-xs">
                       <div className="flex items-center justify-between">
                         <Label className="text-[11px] font-bold text-slate-700 uppercase">{item.label}</Label>
                         <div className="flex gap-1 overflow-x-auto">
                           {item.presets.map((preset, pIdx) => (
                             <button
                               key={pIdx}
                               type="button"
                               onClick={() => setFormData(prev => ({
                                 ...prev,
                                 biotoxins: { ...prev.biotoxins, [item.key]: preset }
                               }))}
                               className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors"
                             >
                               {pIdx === 0 ? 'Not detected' : pIdx === 1 ? 'Below limit' : 'Trace'}
                             </button>
                           ))}
                         </div>
                       </div>
                       <AutoResizeTextarea 
                         minHeight="40px"
                         value={formData.biotoxins[item.key as keyof typeof formData.biotoxins]}
                         onChange={(e) => setFormData(prev => ({ 
                           ...prev, 
                           biotoxins: { ...prev.biotoxins, [item.key]: e.target.value } 
                         }))}
                         placeholder={`Enter data for ${item.label}...`}
                       />
                     </div>
                   ))}
                </div>

                {/* Additional Text & General Summary for Biotoxin */}
                <div className="space-y-2 pt-2 border-t border-[#d4a017]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <Label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide">
                      Additional Text & General Summary (Biotoxin Report)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          biotoxinReport: 'All classified harvesting zones remain within safe statutory limits. Liquid chromatography testing confirms that OA, DTX, PTX, AZA, and YTX levels remain well below regulatory maximum permitted concentrations. No harvesting closures are indicated.'
                        }))}
                        className="text-[9px] px-2 py-0.5 rounded bg-[#fef3c7] hover:bg-[#fde68a] text-amber-900 border border-[#f59e0b]/40 font-semibold transition-colors"
                      >
                        All Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          biotoxinReport: 'Routine monitoring across all Shetland shellfish harvesting areas shows compliant levels. Trace levels of lipophilic toxins detected in isolated sheltered inlets, remaining well under action thresholds.'
                        }))}
                        className="text-[9px] px-2 py-0.5 rounded bg-[#fef3c7] hover:bg-[#fde68a] text-amber-900 border border-[#f59e0b]/40 font-semibold transition-colors"
                      >
                        Trace Advisory
                      </button>
                    </div>
                  </div>
                  <AutoResizeTextarea
                    minHeight="70px"
                    value={formData.biotoxinReport}
                    onChange={(e) => setFormData(prev => ({ ...prev, biotoxinReport: e.target.value }))}
                    placeholder="Enter additional commentary, specific bed notes, harvesting observations, or general summary. The bulletin box automatically resizes to fit all text..."
                    className="bg-white"
                  />
                  <p className="text-[10px] text-slate-500 italic">This text automatically expands the Biotoxin Report box on the Analysis bulletin and prints cleanly.</p>
                </div>
              </div>

              {/* Harmful Algae Report Section */}
              <div id="analysis-section-harmfulAlgae" className="space-y-4 bg-[#fdf3da]/40 p-5 border border-[#d4a017]/30 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#d4a017]/30 pb-2">
                  <div>
                    <Label className="text-base font-black text-[#1e3a8a] uppercase tracking-tight block">Harmful algae report</Label>
                    <p className="text-[11px] text-slate-600">Enter cell counts and observations. All fields expand automatically as you type.</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded border border-[#f59e0b]/40 w-fit">
                    Auto-resizing boxes
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {[
                     { label: 'Alexandrium', key: 'alexandrium', presets: ['< 20 cells/L (Below threshold)', 'Threshold exceeded (> 40 cells/L)', 'Not detected'] },
                     { label: 'Dinophysis', key: 'dinophysis', presets: ['Present at low levels (max 40 cells/L)', '< 80 cells/L (Below warning level)', 'Not detected'] },
                     { label: 'Karenia mikimotoi', key: 'karenia', presets: ['Not detected', 'Low levels observed offshore', 'Dense bloom recorded'] },
                     { label: 'Prorocentrum lima', key: 'prorocentrum', presets: ['< 40 cells/L (Below threshold)', 'Background levels (< 80 cells/L)', 'Not detected'] },
                     { label: 'Pseudo-nitzschia delicatissima', key: 'pseudoDelicatissima', presets: ['Background densities (< 5,000 cells/L)', '< 40,000 cells/L (Below warning)', 'Not detected'] },
                     { label: 'Pseudo-nitzschia seriata', key: 'pseudoSeriata', presets: ['< 2,000 cells/L (Background)', '< 40,000 cells/L (Below warning)', 'Not detected'] }
                   ].map((item) => (
                     <div key={item.key} className="space-y-1.5 bg-white p-3 rounded-md border border-[#d4a017]/25 shadow-xs">
                       <div className="flex items-center justify-between">
                         <Label className="text-[11px] font-bold text-slate-700 uppercase">{item.label}</Label>
                         <div className="flex gap-1 overflow-x-auto">
                           {item.presets.map((preset, pIdx) => (
                             <button
                               key={pIdx}
                               type="button"
                               onClick={() => setFormData(prev => ({
                                 ...prev,
                                 harmfulAlgae: { ...prev.harmfulAlgae, [item.key]: preset }
                               }))}
                               className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors"
                             >
                               {pIdx === 0 ? 'Baseline' : pIdx === 1 ? 'Advisory' : 'None'}
                             </button>
                           ))}
                         </div>
                       </div>
                       <AutoResizeTextarea 
                         minHeight="40px"
                         value={formData.harmfulAlgae[item.key as keyof typeof formData.harmfulAlgae]}
                         onChange={(e) => setFormData(prev => ({ 
                           ...prev, 
                           harmfulAlgae: { ...prev.harmfulAlgae, [item.key]: e.target.value } 
                         }))}
                         placeholder={`Enter data for ${item.label}...`}
                       />
                     </div>
                   ))}
                </div>

                {/* Additional Text & General Summary for Harmful Algae */}
                <div className="space-y-2 pt-2 border-t border-[#d4a017]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <Label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide">
                      Additional Text & General Summary (Harmful Algae Report)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          harmfulAlgaeReport: 'Phytoplankton cell counts remain in typical baseline ranges across all sampling stations. No cell count warnings or threshold breaches recorded for Alexandrium, Dinophysis, or Pseudo-nitzschia species. Water column stratification remains weak with low risk of bloom development.'
                        }))}
                        className="text-[9px] px-2 py-0.5 rounded bg-[#fef3c7] hover:bg-[#fde68a] text-amber-900 border border-[#f59e0b]/40 font-semibold transition-colors"
                      >
                        Baseline Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          harmfulAlgaeReport: 'Microscopic examination indicates low background diversity. Dinophysis species observed in isolated samples at densities well below the 100 cells/L threshold. Karenia mikimotoi absent in all integrated samples.'
                        }))}
                        className="text-[9px] px-2 py-0.5 rounded bg-[#fef3c7] hover:bg-[#fde68a] text-amber-900 border border-[#f59e0b]/40 font-semibold transition-colors"
                      >
                        Low Diversity
                      </button>
                    </div>
                  </div>
                  <AutoResizeTextarea
                    minHeight="70px"
                    value={formData.harmfulAlgaeReport}
                    onChange={(e) => setFormData(prev => ({ ...prev, harmfulAlgaeReport: e.target.value }))}
                    placeholder="Enter additional algae observations, species composition notes, localized hotspot details, or commentary. The bulletin box automatically resizes to fit all text..."
                    className="bg-white"
                  />
                  <p className="text-[10px] text-slate-500 italic">This text automatically expands the Harmful Algae Report box on the Analysis bulletin and prints cleanly.</p>
                </div>
              </div>

              {/* Shetland: Trends and Forecast Section */}
              <div id="analysis-section-trends" className="space-y-5 bg-[#5a7fbf]/10 p-5 border border-[#5a7fbf]/30 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#5a7fbf]/20 pb-2">
                  <div>
                    <Label className="text-base font-black text-[#1e3a8a] uppercase tracking-tight block">Shetland: Trends and Forecast</Label>
                    <p className="text-[11px] text-slate-600">Provide trends, risk ratings, and comprehensive commentary. Automatically resizes to fit all text.</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#1e3a8a] bg-blue-100 px-2 py-0.5 rounded border border-blue-300 w-fit">
                    Auto-resizing box
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {[
                     { label: 'Alexandrium/PSP', key: 'alexandriumPsp', placeholder: 'Water temperatures remain below optimal bloom initiation thresholds (current SST 8.2°C). Low risk of PSP events expected for the coming fortnight.' },
                     { label: 'Dinophysis/DSP', key: 'dinophysisDsp', placeholder: 'Low cell densities persist offshore. Recent wind patterns indicate minimal onshore transport. Risk remains low to moderate in sheltered southwest voes.' },
                     { label: 'Pseudo-nitzschia/ASP', key: 'pseudoNitzschiaAsp', placeholder: 'Diatom populations dominated by non-toxic species. Pseudo-nitzschia numbers well below the 50,000 cells/L action threshold.' },
                     { label: 'AZA and YTX', key: 'azaYtx', placeholder: 'Azadinium and Protoceratium cell concentrations remain negligible. Historical trends suggest low probability of toxic events in early spring.' }
                   ].map((item) => (
                     <div key={item.key} className="space-y-1.5 bg-white p-3 rounded-md border border-[#5a7fbf]/25 shadow-xs">
                       <Label className="text-[11px] font-bold text-[#1e3a8a] uppercase">{item.label}</Label>
                       <AutoResizeTextarea 
                         minHeight="60px"
                         className="italic"
                         value={formData.trends[item.key as keyof typeof formData.trends]}
                         onChange={(e) => setFormData(prev => ({ 
                           ...prev, 
                           trends: { ...prev.trends, [item.key]: e.target.value } 
                         }))}
                         placeholder={item.placeholder}
                       />
                     </div>
                   ))}
                </div>

                {/* Risk Ratings Grid */}
                <div className="space-y-2 pt-2 border-t border-[#5a7fbf]/20">
                  <Label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide">Risk Assessment Levels</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: 'Risk for PSP', key: 'riskPsp' },
                      { label: 'Risk for DSP', key: 'riskDsp' },
                      { label: 'Risk for ASP', key: 'riskAsp' },
                      { label: 'Risk for YTX', key: 'riskYtx' },
                      { label: 'Risk for AZA', key: 'riskAza' }
                    ].map((item) => (
                      <div key={item.key} className="space-y-1.5 bg-white p-2.5 rounded-md border border-[#5a7fbf]/25 shadow-xs">
                        <Label className="text-[10px] font-bold text-slate-700 uppercase block">{item.label}</Label>
                        <Input 
                          className="h-8 text-xs font-semibold"
                          value={formData.trends[item.key as keyof typeof formData.trends]}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            trends: { ...prev.trends, [item.key]: e.target.value } 
                          }))}
                          placeholder="Low/Moderate/High"
                        />
                        <div className="flex gap-1 pt-0.5">
                          {['Low', 'Low-Med', 'Moderate', 'High'].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                trends: { ...prev.trends, [item.key]: opt }
                              }))}
                              className={`text-[8.5px] px-1 py-0.5 rounded font-bold border transition-colors flex-1 text-center ${
                                formData.trends[item.key as keyof typeof formData.trends] === opt
                                  ? 'bg-blue-600 text-white border-blue-700'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Text & Overall Commentary for Trends & Forecast */}
                <div className="space-y-2 pt-2 border-t border-[#5a7fbf]/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <Label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide">
                      Additional Text & Overall Commentary (Trends and Forecast)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          trendsForecast: 'Overall low risk across all aquaculture and wild harvesting sites. Hydrographic conditions, tidal flushing, and offshore wind regimes suggest minimal advective risk of harmful algal transport into coastal voes over the upcoming week.'
                        }))}
                        className="text-[9px] px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 font-semibold transition-colors"
                      >
                        Low Risk Outlook
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          trendsForecast: 'Westerly airflows are forecasted to persist, which may concentrate offshore cell populations towards western voe entrances. Growers in Scalloway and Vaila Sound are advised to maintain standard elevated monitoring protocols.'
                        }))}
                        className="text-[9px] px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 font-semibold transition-colors"
                      >
                        Westerly Advisory
                      </button>
                    </div>
                  </div>
                  <AutoResizeTextarea
                    minHeight="80px"
                    value={formData.trendsForecast}
                    onChange={(e) => setFormData(prev => ({ ...prev, trendsForecast: e.target.value }))}
                    placeholder="Enter additional meteorological outlook, wind-driven transport analysis, advice to harvesters, or overall forecast narrative. The bulletin box automatically resizes to fit all text..."
                    className="bg-white"
                  />
                  <p className="text-[10px] text-slate-500 italic">This text automatically expands the Shetland: Trends and Forecast box on the Analysis bulletin and prints cleanly.</p>
                </div>
              </div>
            </div>
          ) : bulletinType === BulletinType.KARENIA || bulletinType === BulletinType.WIND_ROSE ? (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <Label htmlFor="kareniaStatus" className="text-sm font-bold text-slate-700">
                  {bulletinType === BulletinType.WIND_ROSE ? 'Short Status (Bottom Left Box)' : 'Current Status Text'}
                </Label>
                <textarea 
                  id="kareniaStatus"
                  className="w-full min-h-[100px] p-3 text-base border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 bg-white"
                  placeholder="Enter the week's status update here..."
                  value={formData.kareniaStatus}
                  onChange={(e) => setFormData(prev => ({ ...prev, kareniaStatus: e.target.value }))}
                />
              </div>

              {bulletinType === BulletinType.WIND_ROSE && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="windRoseMonth" className="text-sm font-bold text-slate-700">Month Name (for Bottom Left Box)</Label>
                    <Input 
                      id="windRoseMonth"
                      placeholder='e.g. "March"'
                      value={formData.windRoseMonth}
                      onChange={(e) => setFormData(prev => ({ ...prev, windRoseMonth: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="predictionRisk" className="text-sm font-bold text-slate-700 font-bold">Prediction Risk Level (e.g. "low")</Label>
                    <Input 
                      id="predictionRisk"
                      placeholder='e.g. "low"'
                      value={formData.predictionRisk}
                      onChange={(e) => setFormData(prev => ({ ...prev, predictionRisk: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="predictionWhy" className="text-sm font-bold text-slate-700">Why do we think this? (Predictions Box)</Label>
                    <textarea 
                      id="predictionWhy"
                      className="w-full min-h-[120px] p-3 text-base border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 bg-white italic"
                      placeholder="Enter the explanation for the prediction here..."
                      value={formData.predictionWhy}
                      onChange={(e) => setFormData(prev => ({ ...prev, predictionWhy: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="commentary" className="text-sm font-bold text-slate-700">
                  {bulletinType === BulletinType.WIND_ROSE ? 'Main Description (Middle Text)' : 'Staff Commentary'}
                </Label>
                <textarea 
                  id="commentary" 
                  className="w-full min-h-[120px] p-3 text-base border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 bg-white"
                  placeholder="Enter observations, trends, or critical warnings here..."
                  value={formData.commentary}
                  onChange={(e) => setFormData(prev => ({ ...prev, commentary: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="commentary" className="text-sm font-bold text-slate-700">Staff Commentary / Observations</Label>
              <textarea 
                id="commentary" 
                className="w-full min-h-[120px] p-3 text-base border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 bg-white"
                placeholder="Enter observations, trends, or critical warnings here..."
                value={formData.commentary}
                onChange={(e) => setFormData(prev => ({ ...prev, commentary: e.target.value }))}
              />
            </div>
          )}

          <Button type="submit" className="w-full font-bold">
            {editingReport ? 'Save & Update Report' : 'Generate Weekly Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
