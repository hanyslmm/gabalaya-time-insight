// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-accent/10">
      <div className="text-center space-y-6 p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-xl">
            <span className="text-primary-foreground font-bold text-2xl">G</span>
          </div>
        </div>
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Welcome to Gabalaya HRM
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          A comprehensive Human Resource Management system designed to streamline your workforce operations with modern design and powerful features.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button className="px-8 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            Get Started
          </button>
          <button className="px-8 py-3 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary/10 transition-all duration-200">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
