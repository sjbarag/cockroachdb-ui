import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { DatabasesTable } from "@cockroachlabs/o11y-ui/dist/databases";

const meta: Meta<typeof DatabasesTable> = {
  title: "O11Y UI/Databases Table",
  component: DatabasesTable,
  tags: ["autodocs"],
  argTypes: {
    loading: {
      type: "boolean",
    },
    databases: {
      type: {
        name: "array",
        value: {
          name: "object",
          value: {
            name: { name: "string" },
            sizeInBytes: { name: "number" },
            tableCount: { name: "number" },
            rangeCount: { name: "number" },
            numIndexRecommendations: { name: "number" },
          },
        },
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof DatabasesTable>;
export const Empty: Story = {
  argTypes: {
    databases: {
      table: {
        disable: true,
      }
    }
  },
  args: {
    loading: false,
  },
  render: (props) => (
    <DatabasesTable
      databases={[]}
      loading={props.loading}
      error={null}
      />
  ),
};

export const Filled: Story = {
  args: {
    databases: [
      {
        name: "defaultdb",
        sizeInBytes: 0,
        tableCount: 0,
        rangeCount: 0,
        numIndexRecommendations: 0,
      },
      {
        name: "movr",
        sizeInBytes: 289_423,
        tableCount: 6,
        rangeCount: 6,
        numIndexRecommendations: 0,
      },
      {
        name: "postgres",
        sizeInBytes: 0,
        tableCount: 0,
        rangeCount: 0,
        numIndexRecommendations: 0,
      },
      {
        name: "system",
        sizeInBytes: 1_000_000,
        tableCount: 43,
        rangeCount: 45,
        numIndexRecommendations: 0,
      },
    ],
    loading: false,
  },
  render: (props) => (
    <DatabasesTable
      databases={props.databases}
      loading={props.loading}
      error={null}
    />
  ),
};
