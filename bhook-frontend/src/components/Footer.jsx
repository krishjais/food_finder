import React from 'react';
import { Database, Layers } from 'lucide-react';
import BhookLogo from './BhookLogo';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white py-12 text-stone-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-stone-100">
          
          {/* Brand & Purpose */}
          <div className="flex items-center gap-3">
            <BhookLogo size="sm" />
          </div>

          {/* Portfolio Note & Neutral Aggregation Statement */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-stone-500">
            <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200">
              <Layers className="w-3.5 h-3.5 text-orange-600" />
              <span>Aggregating prices across delivery platforms</span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200">
              <Database className="w-3.5 h-3.5 text-stone-400" />
              <span>Swiggy and Zomato price comparison in Lucknow</span>
            </div>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400 text-center sm:text-left">
          <p>
            Portfolio demonstration project. Built with React, Vite &amp; Express.
          </p>
          <p>
            Brand names are referenced purely for informational aggregation and remain property of their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}
