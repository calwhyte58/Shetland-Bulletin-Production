import React from 'react';

const LegendItem = ({ color, label, size = 'normal' }: { color: string, label: string, size?: 'normal' | 'large' | 'xlarge' }) => {
  const sizeClass = size === 'xlarge' ? 'w-4 h-4' : size === 'large' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-2">
      <div className={`${color} ${sizeClass} rounded-full flex-shrink-0`} />
      <span className="text-[9px] font-bold text-black leading-tight whitespace-nowrap">{label}</span>
    </div>
  );
};

const LegendContainer = ({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 p-1 bg-transparent h-full">
    <h3 className="font-bold text-[10px] mb-0.5 leading-none uppercase">{title}</h3>
    <p className="text-[8px] font-semibold mb-0.5 text-black leading-none">{subtitle}</p>
    <div className="flex flex-col gap-0.5">
      {children}
    </div>
  </div>
);

export const DSPLegend = () => (
  <LegendContainer title="OA/DTXs/PTXs" subtitle="µg OA eq/kg">
    <LegendItem color="bg-blue-500" label="Not Analyzed" />
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-yellow-400" label="0-80" />
    <LegendItem color="bg-orange-500" label="80-160" />
    <LegendItem color="bg-red-500" label="160-500" />
    <LegendItem color="bg-red-700" label="500-1,000" />
    <LegendItem color="bg-red-800" label="1,000-2,000" />
    <LegendItem color="bg-red-900" label="2,000-5,000" size="large" />
    <LegendItem color="bg-red-950" label=">=5,000" size="xlarge" />
  </LegendContainer>
);

export const DinophysisLegend = () => (
  <LegendContainer title="Dinophysis Sp." subtitle="cells\l">
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-yellow-400" label="0-80" />
    <LegendItem color="bg-orange-500" label="80-100" />
    <LegendItem color="bg-red-500" label="100-400" />
    <LegendItem color="bg-red-700" label="400-1,000" />
    <LegendItem color="bg-red-800" label="1,000-2,000" />
    <LegendItem color="bg-red-900" label="2,000-5,000" size="large" />
    <LegendItem color="bg-red-950" label=">=5,000" size="xlarge" />
  </LegendContainer>
);

export const PSPLegend = () => (
  <LegendContainer title="PSP" subtitle="µg STX eq/kg">
    <LegendItem color="bg-blue-500" label="Not Analyzed" />
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-yellow-300" label="0-400" />
    <LegendItem color="bg-orange-400" label="400-800" />
    <LegendItem color="bg-red-500" label="800-1,600" />
    <LegendItem color="bg-red-700" label="1,600-2,000" />
    <LegendItem color="bg-red-800" label="2,000-3,000" size="large" />
    <LegendItem color="bg-red-900" label="3,000-4,000" size="large" />
    <LegendItem color="bg-red-950" label=">=4,000" size="xlarge" />
  </LegendContainer>
);

export const AlexandriumLegend = () => (
  <LegendContainer title="Alexandrium Sp." subtitle="cells\l">
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-yellow-400" label="1-20" />
    <LegendItem color="bg-orange-500" label="20-500" />
    <LegendItem color="bg-red-500" label="500-2,000" />
    <LegendItem color="bg-red-700" label="2,000-5,000" size="large" />
    <LegendItem color="bg-red-800" label="5,000-20,000" size="large" />
    <LegendItem color="bg-red-950" label=">=20,000" size="xlarge" />
  </LegendContainer>
);

export const ASPLegend = () => (
  <LegendContainer title="ASP" subtitle="mg/kg">
    <LegendItem color="bg-blue-500" label="Not Analyzed" />
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-yellow-400" label="0-10" />
    <LegendItem color="bg-orange-500" label="10-20" />
    <LegendItem color="bg-red-500" label="20-50" />
    <LegendItem color="bg-red-600" label="50-100" />
    <LegendItem color="bg-red-700" label="100-500" size="large" />
    <LegendItem color="bg-red-800" label="500-1,000" size="large" />
    <LegendItem color="bg-red-950" label=">=1,000" size="xlarge" />
  </LegendContainer>
);

export const PseudoNitzschiaLegend = () => (
  <LegendContainer title="Pseudo-nitzschia Sp." subtitle="cells\l">
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-green-300" label="0-39,999" />
    <LegendItem color="bg-yellow-400" label="40,000-49,999" />
    <LegendItem color="bg-orange-500" label="50,000-100,000" />
    <LegendItem color="bg-red-500" label="100,000-200,000" />
    <LegendItem color="bg-red-700" label="200,000-500,000" size="large" />
    <LegendItem color="bg-red-800" label="500,000-1,000,000" size="large" />
    <LegendItem color="bg-red-950" label=">=1,000,000" size="xlarge" />
  </LegendContainer>
);

export const AZALegend = () => (
  <LegendContainer title="AZAs" subtitle="µg AZA1 eq/kg">
    <LegendItem color="bg-blue-500" label="Not Analyzed" />
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-yellow-400" label="0-100" />
    <LegendItem color="bg-orange-500" label="100-160" />
    <LegendItem color="bg-red-500" label="160-500" />
    <LegendItem color="bg-red-600" label="500-1,000" />
    <LegendItem color="bg-red-700" label="1,000-2,000" size="large" />
    <LegendItem color="bg-red-800" label="2,000-5,000" size="large" />
    <LegendItem color="bg-red-950" label=">=5,000" size="xlarge" />
  </LegendContainer>
);

export const YTXLegend = () => (
  <LegendContainer title="YTXs" subtitle="mg YTX eq/kg">
    <LegendItem color="bg-blue-500" label="Not Analyzed" />
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-yellow-400" label="0-1.4" />
    <LegendItem color="bg-orange-500" label="1.5-3.74" />
    <LegendItem color="bg-red-600" label=">=3.75" />
  </LegendContainer>
);

export const KareniaLegend = () => (
  <LegendContainer title="Karenia mikimotoi" subtitle="cells\l">
    <LegendItem color="bg-red-600" label=">3,000,000" size="xlarge" />
    <LegendItem color="bg-orange-500" label=">500,000" size="large" />
    <LegendItem color="bg-yellow-400" label="" />
    <LegendItem color="bg-green-500" label="0" />
    <LegendItem color="bg-blue-500" label="" />
  </LegendContainer>
);

export const SSTLegend = () => (
  <div className="flex flex-col gap-1 p-1 justify-center items-end pr-2">
    <h3 className="font-bold text-[9px] uppercase text-center w-full mb-1">Temp °C</h3>
    <div className="flex items-center gap-1.5">
      <div 
        className="h-32 w-4 rounded-sm border border-black/20"
        style={{ background: 'linear-gradient(to top, #000080, #0000ff, #00ffff, #ffff00, #ff7f00, #ff0000)' }}
      />
      <div className="flex flex-col justify-between h-32 py-0.5">
        {[15, 14, 13, 12, 11, 10, 9, 8].map((temp, idx) => {
          const colors = ['#ff0000', '#ff5500', '#ffaa00', '#ffff00', '#00ffaa', '#00ffff', '#0000ff', '#000080'];
          return (
            <div key={temp} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full border border-black/10" style={{ backgroundColor: colors[idx] }} />
              <span className="text-[9px] font-bold text-black leading-none">{temp}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export const SSCLegend = () => (
  <div className="flex flex-col gap-1 p-1 justify-center items-end pr-2">
    <h3 className="font-bold text-[9px] uppercase text-center w-full mb-1">m/s</h3>
    <div className="flex items-center gap-1.5">
      <div 
        className="h-40 w-4 rounded-sm border border-black/20"
        style={{ background: 'linear-gradient(to top, #000080, #0000ff, #00ffff, #ffff00, #ff7f00, #ff0000)' }}
      />
      <div className="flex flex-col justify-between h-40 py-0.5">
        {[0.5, 0.4, 0.3, 0.2, 0.1, 0.0].map((speed, idx) => {
          const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ffff', '#0000ff', '#000080'];
          return (
            <div key={speed} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full border border-black/10" style={{ backgroundColor: colors[idx] }} />
              <span className="text-[9px] font-bold text-black leading-none">{speed.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export const ChlorophyllLegend = () => (
  <div className="flex flex-col gap-1 p-1 justify-center items-end pr-2">
    <h3 className="font-bold text-[9px] uppercase text-center w-full mb-1">mg/m³</h3>
    <div className="flex items-center gap-1.5">
      <div 
        className="h-40 w-4 rounded-sm border border-black/20"
        style={{ background: 'linear-gradient(to top, #000080, #0000ff, #00ffff, #ffff00, #ff7f00, #ff0000)' }}
      />
      <div className="flex flex-col justify-between h-40 py-0.5">
        {[10.0, 1.0, 0.1, 0.01].map((val, idx) => {
          const colors = ['#ff0000', '#ffff00', '#00ffff', '#000080'];
          return (
            <div key={val} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full border border-black/10" style={{ backgroundColor: colors[idx] }} />
              <span className="text-[9px] font-bold text-black leading-none">{val.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
