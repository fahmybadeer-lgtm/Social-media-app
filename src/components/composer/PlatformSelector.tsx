const successMsg =
        submitStatus === 'published'
          ? 'Post published to Facebook!'
          : submitStatus === 'scheduled'
          ? 'Post scheduled successfully!'
          : 'Draft saved successfully!'
