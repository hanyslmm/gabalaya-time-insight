  const handleClockIn = async () => {
    if (!user) {
      toast.error('Please log in to clock in');
      return;
    }

    setLoading(true);
    try {
      const userLocation = await getCurrentLocation();
      setLocation(userLocation);

      // Call the database function
      const { data, error } = await supabase.rpc('clock_in', {
        clock_in_location: userLocation,
      });

      if (error) {
        throw new Error(error.message);
      }

      // **THE FIX FOR THE BUILD ERROR:**
      // We explicitly check that 'data' is not null and then create a new,
      // correctly typed 'ClockEntry' object before updating our application's state.
      // This prevents TypeScript errors during the production build process.
      if (data) {
        const newEntry: ClockEntry = {
          id: data.id,
          employee_name: data.employee_name,
          clock_in_time: data.clock_in_time,
          clock_in_date: data.clock_in_date,
          clock_out_time: data.clock_out_time,
          clock_out_date: data.clock_out_date,
          clock_in_location: data.clock_in_location,
          total_hours: data.total_hours,
        };
        setCurrentEntry(newEntry);
      }
      
      fetchTodayEntries();
      toast.success('Clocked in successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock in');
      console.error('Clock-in error:', error);
    } finally {
      setLoading(false);
    }
  };
