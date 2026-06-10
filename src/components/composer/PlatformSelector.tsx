const platformNames = form.platforms
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' & ')
      const successMsg =
        submitStatus === 'published'
          ? `Post published to ${platformNames}!`
          : submitStatus === 'scheduled'
          ? `Post scheduled for ${platformNames}!`
          : 'Draft saved successfully!'
