
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Package, Beaker, ArrowRight, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';

const HomePage = () => {
  const navigationCards = [
    {
      title: 'Briefs',
      description: 'Mulai dari brief dan arah formula.',
      icon: ClipboardList,
      path: '/briefs',
      color: 'from-primary/10 to-amber-500/10',
      iconColor: 'text-primary',
      hoverColor: 'hover:border-primary/30'
    },
    {
      title: 'Materials',
      description: 'Kelola library bahan dan shortlist.',
      icon: Package,
      path: '/raw-materials',
      color: 'from-amber-500/10 to-orange-500/10',
      iconColor: 'text-amber-600',
      hoverColor: 'hover:border-amber-500/30'
    },
    {
      title: 'Formulas',
      description: 'Compose, review, dan evaluasi formula.',
      icon: Beaker,
      path: '/formulas',
      color: 'from-emerald-500/10 to-teal-500/10',
      iconColor: 'text-emerald-600',
      hoverColor: 'hover:border-emerald-500/30'
    }
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard - Formulation Workspace</title>
        <meta name="description" content="Build perfume formulas with briefs, materials, workbook guidance, and performance analysis." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12 sm:mb-16"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
              Formulation Workspace
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
              Workspace formulasi untuk brief, shortlist, formula, dan validation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {navigationCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link to={card.path}>
                    <div
                      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${card.color} p-5 sm:p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${card.hoverColor}`}
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className={`p-3 rounded-xl bg-background/80 backdrop-blur-sm ${card.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                          <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                      </div>
                      <h2 className="mb-2 text-xl font-semibold transition-colors duration-300 group-hover:text-foreground">
                        {card.title}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/briefs">
              <button className="rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]">
                Start from briefs
              </button>
            </Link>
            <Link to="/formulas">
              <button className="rounded-xl border bg-white/80 px-5 py-3 font-medium transition-all duration-200 hover:bg-white">
                Open formulas
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
