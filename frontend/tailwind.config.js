export default {
  content:['./index.html','./src/**/*.{js,jsx}'],
  theme:{
    extend:{
      colors:{
        canvas:'var(--canvas)',
        surface:'var(--surface)',
        'surface-raised':'var(--surface-raised)',
        border:'var(--border)',
        accent:'var(--accent)',
        'accent-secondary':'var(--accent-secondary)',
        'accent-soft':'var(--accent-soft)',
        text:'var(--text)',
        muted:'var(--muted)',
        'risk-red':'var(--risk-red)',
        'risk-amber':'var(--risk-amber)',
        'risk-green':'var(--risk-green)',
        'risk-neutral':'var(--risk-neutral)',
      },
      fontFamily:{
        sans:['DM Sans','sans-serif'],
        display:['Space Grotesk','sans-serif'],
      },
    },
  },
  plugins:[],
};
