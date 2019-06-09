function ClockfaceSettings(props) {
  return (
    <Page>
      <Section
        title={<Text bold align="center">Color Settings</Text>}>
        <Text bold-align="center">Color Background</Text>
        <ColorSelect
          settingsKey="colorBackground"
          colors={[
            {color: 'tomato'},
            {color: 'sandybrown'},
            {color: 'gold'},
            {color: 'aquamarine'},
            {color: 'deepskyblue'},
            {color: 'plum'},
            {color: "black"},
            {color: "white"}
          ]}
        />
        <Text bold-align="center">Color Text</Text>
        <ColorSelect
          settingsKey="colorText"
          colors={[
            {color: 'tomato'},
            {color: 'sandybrown'},
            {color: 'gold'},
            {color: 'aquamarine'},
            {color: 'deepskyblue'},
            {color: 'plum'},
            {color: "black"},
            {color: "white"}
          ]}
        />
        <TextInput title="NightscoutUrl" label="Nightscout URL:" settingsKey="nightscoutSiteName"/>
      </Section>
    </Page>
  );
}

registerSettingsPage(ClockfaceSettings);