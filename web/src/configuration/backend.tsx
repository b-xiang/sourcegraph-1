import { Observable } from 'rxjs'
import { map, mergeMap, take } from 'rxjs/operators'
import * as GQL from '../../../shared/src/graphqlschema'
import { dataOrThrowErrors, gql, GraphQLDocument, GraphQLResult, mutateGraphQL } from '../backend/graphql'
import { settingsCascade } from '../settings/configuration'
import { refreshSettings } from '../user/settings/backend'

/**
 * Overwrites the settings for the subject.
 */
export function overwriteSettings(subject: GQL.ID, lastID: number | null, contents: string): Observable<void> {
    return mutateGraphQL(
        gql`
            mutation OverwriteSettings($subject: ID!, $lastID: Int, $contents: String!) {
                settingsMutation(input: { subject: $subject, lastID: $lastID }) {
                    overwriteSettings(contents: $contents) {
                        empty {
                            alwaysNil
                        }
                    }
                }
            }
        `,
        { subject, lastID, contents }
    ).pipe(
        map(dataOrThrowErrors),
        map(() => undefined)
    )
}

export function editSettings(subject: GQL.ID, lastID: number | null, edit: GQL.ISettingsEdit): Observable<void> {
    return mutateGraphQL(
        gql`
            mutation EditSettings($subject: ID!, $lastID: Int, $edit: SettingsEdit!) {
                settingsMutation(input: { subject: $subject, lastID: $lastID }) {
                    editSettings(edit: $edit) {
                        empty {
                            alwaysNil
                        }
                    }
                }
            }
        `,
        { subject, lastID, edit }
    ).pipe(
        map(dataOrThrowErrors),
        map(() => undefined)
    )
}

/**
 * Runs a GraphQL mutation that includes settings mutations, populating the variables object
 * with the lastID and subject for the settings mutation.
 *
 * @param subject The subject whose settings to update.
 * @param mutation The GraphQL mutation.
 * @param variables The GraphQL mutation's variables.
 */
export function mutateSettingsGraphQL(
    subject: GQL.SettingsSubject | GQL.ISettingsSubject | { id: GQL.ID },
    mutation: GraphQLDocument,
    variables: any = {}
): Observable<GraphQLResult<GQL.IMutation>> {
    const subjectID = subject.id
    if (!subjectID) {
        throw new Error('subject has no id')
    }
    return settingsCascade.pipe(
        take(1),
        mergeMap(settings => {
            const subjectSettings = settings.subjects.find(s => s.id === subjectID)
            if (!subjectSettings) {
                throw new Error(`no settings subject: ${subjectID}`)
            }
            const lastID = subjectSettings.latestSettings ? subjectSettings.latestSettings.id : null

            return mutateGraphQL(mutation, { ...variables, subject: subjectID, lastID })
        }),
        map(result => {
            refreshSettings().subscribe()
            return result
        })
    )
}
