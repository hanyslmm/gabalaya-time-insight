const handleClockIn = async () => {
    if (!user) {
      toast.error('Please log in to clock in');
      return;
    }

    setLoading(true);
    try {
      const userLocation = await getCurrentLocation();
      setLocation(userLocation);
      
      // This is the new part: calling our database function.
      const { data, error } = await supabase.rpc('clock_in', {
        clock_in_location: userLocation
      });

      if (error) {
        // If the database function itself throws an error, we catch it here.
        throw error;
      }

      // The function returns the new timesheet entry, so we can update the UI.
      setCurrentEntry(data);
      fetchTodayEntries();
      toast.success('Clocked in successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock in');
      console.error('Clock-in error:', error);
    } finally {
      setLoading(false);
    }
  };
