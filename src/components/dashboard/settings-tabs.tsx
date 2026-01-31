"use client";

import { useState } from "react";
import { Box, Tabs, Tab, Typography, Container } from "@mui/material";
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Email as EmailIcon,
} from "@mui/icons-material";
import SettingsForm from "@/app/dashboard/settings/settings-form";
import OrgMembersList from "./org-members-list";
import InvitationsList from "./invitations-list";
import InviteMemberForm from "./invite-member-form";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface SettingsTabsProps {
  profile: {
    id: string;
    full_name: string;
    email: string;
    timezone: string;
    locale: string;
  };
  organization: any;
  orgMembers: any[];
  pendingInvitations: any[];
  teams?: { id: string; name: string }[];
}

export default function SettingsTabs({
  profile,
  organization,
  orgMembers,
  pendingInvitations,
  teams = [],
}: SettingsTabsProps) {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 3 }}>
        <Tabs value={value} onChange={handleChange} aria-label="settings tabs">
          <Tab icon={<PersonIcon />} label="Profile" />
          {organization && (
            <>
              <Tab icon={<BusinessIcon />} label="Organization" />
              <Tab icon={<PeopleIcon />} label="Members" />
              <Tab icon={<EmailIcon />} label="Invitations" />
            </>
          )}
        </Tabs>
      </Box>

      <TabPanel value={value} index={0}>
        <SettingsForm profile={profile} />
      </TabPanel>

      {organization && (
        <>
          <TabPanel value={value} index={1}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Organization Details
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                <strong>Name:</strong> {organization.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>ID:</strong> {organization.id}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Billing and subscription management coming soon.
              </Typography>
            </Box>
          </TabPanel>

          <TabPanel value={value} index={2}>
            <OrgMembersList
              members={orgMembers}
              organizationId={organization.id}
              currentUserId={profile.id}
            />
          </TabPanel>

          <TabPanel value={value} index={3}>
            <InviteMemberForm organizationId={organization.id} teams={teams} />
            <InvitationsList
              invitations={pendingInvitations}
              organizationId={organization.id}
            />
          </TabPanel>
        </>
      )}
    </Container>
  );
}
