
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Package, Beaker, Boxes, ArrowRight, Calculator } from 'lucide-react';
import { motion } from 'framer-motion';

const HomePage = () => {
  const navigationCards = [
    {
      title: 'Raw materials',
      description: 'Manage your inventory of essential oils, aroma chemicals, and solvents',
      icon: Package,
      path: '/raw-materials',
      color: 'from-amber-500/10 to-orange-500/10',
      iconColor: 'text-amber-600',
      hoverColor: 'hover:border-amber-500/30'
    },
    {
      title: 'Formulas',
      description: 'Build complete perfume and accord formulas around raw materials and solvent composition',
      icon: Beaker,
      path: '/formulas',
      color: 'from-primary/10 to-amber-500/10',
      iconColor: 'text-primary',
      hoverColor: 'hover:border-primary/30'
    },
    {
      title: 'Batches',
      description: 'Track production batches and manage material usage',
      icon: Boxes,
      path: '/batches',
      color: 'from-emerald-500/10 to-teal-500/10',
      iconColor: 'text-emerald-600',
      hoverColor: 'hover:border-emerald-500/30'
    },
    {
      title: 'Production Costing',
      description: 'Convert batch volume into bottle output and calculate extra bottle, cap, and packaging costs',
      icon: Calculator,
      path: '/production-costing',
      color: 'from-sky-500/10 to-cyan-500/10',
      iconColor: 'text-sky-600',
      hoverColor: 'hover:border-sky-500/30'
    }
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard - Perfumer Studio</title>
        <meta name="description" content="Manage your perfume production workflow with tools for raw materials, formulas, and batches." />
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
              Perfumer Studio
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl">
              Manage your perfume production workflow
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
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
                      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${card.color} p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${card.hoverColor}`}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className={`p-3 rounded-xl bg-background/80 backdrop-blur-sm ${card.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                          <Icon className="w-8 h-8" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                      </div>
                      <h2 className="text-2xl font-semibold mb-3 transition-colors duration-300 group-hover:text-foreground">
                        {card.title}
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-16 p-6 rounded-xl bg-muted/50 border"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Getting started</h3>
                <p className="text-muted-foreground">
                  Begin by adding raw materials to your inventory, then create perfume or accord formulas to build your collection.
                </p>
              </div>
              <Link to="/raw-materials">
                <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]">
                  Add materials
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
