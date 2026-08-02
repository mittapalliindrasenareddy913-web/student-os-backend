const test = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/college/directory?state=Andhra%20Pradesh');
    const data = await res.json();
    console.log(`\nDirectory endpoint returned ${data.length} colleges for Andhra Pradesh.`);
    if (data.length > 0) {
      console.log(`First college: ${data[0].name} (${data[0].collegeCode})\n`);
    }
  } catch (err) {
    console.error(err);
  }
};
test();
